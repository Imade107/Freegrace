// Live Multiplayer Player Voice Chat Controller (WebRTC P2P + Hub Relay Clips fallback).
// Supports Push-to-Talk (hold button / [V] key), Open Mic with VAD, spatial stereo mixing,
// and graceful degradation when microphone permission or WebRTC is unavailable.

const PLAYER_VOICE_STORAGE_KEY = "geminisland_player_voice_v1";
export const PLAYER_VOICE_OPTIONS = Object.freeze([
  { id: "Puck", label: "Puck · Bright & Upbeat" },
  { id: "Kore", label: "Kore · Warm & Friendly" },
  { id: "Zephyr", label: "Zephyr · Breezy & Crisp" },
  { id: "Fenrir", label: "Fenrir · Bold & Steady" },
  { id: "Charon", label: "Charon · Deep & Calm" },
]);

const VALID_VOICE_SET = new Set(PLAYER_VOICE_OPTIONS.map((v) => v.id));
const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const MAX_CLIP_B64_CHARS = 44_000;
const CHUNK_TIMESLICE_MS = 1_150;
const VAD_THRESHOLD = 0.032;
const VAD_HANGOVER_MS = 650;

export function loadSavedPlayerVoice() {
  try {
    if (typeof localStorage === "undefined") return "Puck";
    const v = localStorage.getItem(PLAYER_VOICE_STORAGE_KEY);
    return v && VALID_VOICE_SET.has(v) ? v : "Puck";
  } catch {
    return "Puck";
  }
}

export function savePlayerVoice(voice) {
  const clean = VALID_VOICE_SET.has(voice) ? voice : "Puck";
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PLAYER_VOICE_STORAGE_KEY, clean);
    }
  } catch {
    // Ignore private-mode storage restrictions
  }
  return clean;
}

export function computeSpatialAudioMix(viewerPose, targetPose) {
  if (!viewerPose || !targetPose) {
    return { pan: 0, gain: 0.9, dist: 0 };
  }
  const vx = Number(viewerPose.x) || 0;
  const vz = Number(viewerPose.z) || 0;
  const vYaw = Number(viewerPose.yaw) || 0;
  const vRoom = viewerPose.room || null;

  const tx = Number(targetPose.x);
  const tz = Number(targetPose.z);
  const tRoom = targetPose.room || null;

  if (!Number.isFinite(tx) || !Number.isFinite(tz)) {
    return { pan: 0, gain: vRoom === tRoom ? 0.85 : 0.25, dist: 12 };
  }

  // Different interior room vs exterior muffles audio cleanly
  if (vRoom !== tRoom) {
    return { pan: 0, gain: 0.14, dist: 48 };
  }

  const dx = tx - vx;
  const dz = tz - vz;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.8) {
    return { pan: 0, gain: 1.0, dist };
  }

  // Camera right vector matches Three.js fpCamera yaw convention
  const rightX = Math.cos(vYaw);
  const rightZ = -Math.sin(vYaw);
  const pan = Math.max(-1, Math.min(1, (dx * rightX + dz * rightZ) / Math.max(1.5, dist)));
  const norm = Math.max(0, 1 - dist / 68);
  const gain = Math.max(0.08, Math.pow(norm, 1.35));
  return { pan, gain, dist };
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(bin);
}

function pickRecorderMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

export function createPlayerVoiceChatController(options = {}) {
  const {
    getMpClient,
    soundEngine,
    getLocalPose,
    onStateChange,
    onPeerSpeakingChange,
    onToast,
  } = options;

  let disposed = false;
  let micStream = null;
  let micPromptInFlight = false;
  let micPermission = "prompt"; // "prompt" | "granted" | "denied" | "unsupported"
  let openMic = false;
  let pushToTalkActive = false;
  let speaking = false;
  let micLevel = 0;
  let lastVadAboveMs = 0;

  // Web Audio RMS meter
  let meterCtx = null;
  let meterAnalyser = null;
  let meterSrc = null;
  let meterTimer = null;
  let meterBins = null;

  // Hub-relayed MediaRecorder segment loop (guaranteed delivery even over HTTP proxy iframes)
  let segmentLoopTimer = null;
  let activeRecorder = null;
  let clipRecordingSince = 0;
  let lastSentClipAt = 0;

  // WebRTC P2P per-peer connections
  const rtcPeers = new Map(); // peerId -> { pc, connected, makingOffer, pendingIce }
  const peerSpeakingTimers = new Map();

  function getMp() {
    return typeof getMpClient === "function" ? getMpClient() : null;
  }

  function isMicSupported() {
    return (
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function")
    );
  }

  function getState() {
    return {
      supported: isMicSupported(),
      micPermission,
      micActive: Boolean(micStream),
      openMic,
      pushToTalkActive,
      speaking,
      micLevel,
      rtcConnectedPeers: Array.from(rtcPeers.values()).filter((p) => p.connected).length,
    };
  }

  function emitState() {
    onStateChange?.(getState());
  }

  function broadcastVoiceState(force = false) {
    const mp = getMp();
    if (!mp?.sendVoiceState) return;
    if (force || micStream || openMic || pushToTalkActive || speaking) {
      mp.sendVoiceState(speaking, Boolean(micStream && (openMic || pushToTalkActive)));
    }
  }

  function updateSpeakingFlag(nextSpeaking) {
    const clean = Boolean(nextSpeaking);
    if (clean === speaking) return;
    speaking = clean;
    broadcastVoiceState(true);
    emitState();
  }

  function startMeterLoop() {
    if (meterTimer !== null || !micStream) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        meterCtx = new AudioCtx();
        if (meterCtx.state === "suspended") {
          meterCtx.resume().catch(() => {});
        }
        meterSrc = meterCtx.createMediaStreamSource(micStream);
        meterAnalyser = meterCtx.createAnalyser();
        meterAnalyser.fftSize = 256;
        meterAnalyser.smoothingTimeConstant = 0.65;
        meterSrc.connect(meterAnalyser);
        meterBins = new Float32Array(meterAnalyser.fftSize);
      }
    } catch {
      meterAnalyser = null;
    }

    meterTimer = setInterval(() => {
      if (disposed || !micStream) return;
      let rms = 0;
      if (meterAnalyser && meterBins) {
        meterAnalyser.getFloatTimeDomainData(meterBins);
        let sumSq = 0;
        for (let i = 0; i < meterBins.length; i++) {
          const s = meterBins[i];
          sumSq += s * s;
        }
        rms = Math.sqrt(sumSq / meterBins.length);
      }
      const normalized = Math.min(1, rms * 5.5);
      micLevel = micLevel * 0.5 + normalized * 0.5;

      const now = performance.now();
      if (pushToTalkActive) {
        updateSpeakingFlag(true);
      } else if (openMic) {
        if (normalized >= VAD_THRESHOLD) {
          lastVadAboveMs = now;
        }
        updateSpeakingFlag(now - lastVadAboveMs < VAD_HANGOVER_MS);
      } else {
        updateSpeakingFlag(false);
      }

      emitState();
    }, 90);
  }

  function stopMeterLoop() {
    if (meterTimer !== null) {
      clearInterval(meterTimer);
      meterTimer = null;
    }
    try {
      meterSrc?.disconnect();
      meterAnalyser?.disconnect();
      meterCtx?.close();
    } catch {
      // Ignore cleanup errors
    }
    meterCtx = null;
    meterSrc = null;
    meterAnalyser = null;
    meterBins = null;
    micLevel = 0;
  }

  async function ensureMicrophone() {
    if (disposed) return null;
    if (micStream) return micStream;
    if (!isMicSupported()) {
      micPermission = "unsupported";
      emitState();
      onToast?.("Microphone not supported in this browser — use text chat & AI Voice!", 3400);
      return null;
    }
    if (micPromptInFlight) return null;
    micPromptInFlight = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (disposed) {
        for (const t of stream.getTracks()) t.stop();
        return null;
      }
      micStream = stream;
      micPermission = "granted";
      startMeterLoop();
      attachLocalTrackToRtcPeers();
      broadcastVoiceState(true);
      emitState();
      return micStream;
    } catch (err) {
      micPermission = err?.name === "NotAllowedError" ? "denied" : "unsupported";
      openMic = false;
      pushToTalkActive = false;
      updateSpeakingFlag(false);
      emitState();
      onToast?.(
        micPermission === "denied"
          ? "Microphone access blocked — allow mic permission or use text + AI Voice."
          : "Could not access microphone device.",
        3800,
      );
      return null;
    } finally {
      micPromptInFlight = false;
    }
  }

  function releaseMicrophoneIfIdle() {
    if (openMic || pushToTalkActive) return;
    stopSegmentCapture();
    stopMeterLoop();
    if (micStream) {
      for (const track of micStream.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
      micStream = null;
    }
    updateSpeakingFlag(false);
    broadcastVoiceState(true);
    emitState();
  }

  function stopCurrentSegment(sendIfReady = true) {
    if (!activeRecorder) return;
    const rec = activeRecorder;
    activeRecorder = null;
    if (!sendIfReady) {
      rec.ondataavailable = null;
      rec.onstop = null;
    }
    try {
      if (rec.state !== "inactive") {
        rec.stop();
      }
    } catch {
      // ignore
    }
  }

  function startSegmentCapture() {
    if (disposed || !micStream || typeof MediaRecorder === "undefined") return;
    if (!pushToTalkActive && !openMic) return;
    if (activeRecorder && activeRecorder.state === "recording") return;

    const mimeType = pickRecorderMimeType();
    let rec;
    try {
      rec = mimeType
        ? new MediaRecorder(micStream, { mimeType, audioBitsPerSecond: 20_000 })
        : new MediaRecorder(micStream);
    } catch {
      try {
        rec = new MediaRecorder(micStream);
      } catch {
        return;
      }
    }

    const chunks = [];
    clipRecordingSince = performance.now();
    const shouldTransmitNow = () => pushToTalkActive || (openMic && speaking);

    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        chunks.push(ev.data);
      }
    };

    rec.onstop = async () => {
      if (disposed || chunks.length === 0) return;
      const elapsedMs = Math.round(performance.now() - clipRecordingSince);
      const mp = getMp();
      if (!mp?.sendVoiceClip) return;
      // Avoid sending empty silence slices while Open Mic is quiet
      if (!pushToTalkActive && elapsedMs > 300 && performance.now() - lastVadAboveMs > 1200) {
        return;
      }
      if (performance.now() - lastSentClipAt < 260) return;
      try {
        const blob = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" });
        if (blob.size < 360) return;
        const arrBuf = await blob.arrayBuffer();
        const b64 = arrayBufferToBase64(arrBuf);
        if (b64.length > MAX_CLIP_B64_CHARS || b64.length < 64) return;
        lastSentClipAt = performance.now();
        const cleanMime = (blob.type || mimeType || "audio/webm").split(";")[0].trim();
        mp.sendVoiceClip({
          mimeType: cleanMime,
          audioBase64: b64,
          durationMs: Math.max(200, Math.min(4000, elapsedMs)),
        });
      } catch {
        // Ignore encoding hiccups
      }
    };

    activeRecorder = rec;
    try {
      rec.start();
    } catch {
      activeRecorder = null;
      return;
    }

    if (segmentLoopTimer !== null) {
      clearTimeout(segmentLoopTimer);
    }
    segmentLoopTimer = setTimeout(() => {
      segmentLoopTimer = null;
      if (activeRecorder === rec) {
        stopCurrentSegment(shouldTransmitNow() || pushToTalkActive);
        if (!disposed && micStream && (pushToTalkActive || openMic)) {
          startSegmentCapture();
        }
      }
    }, CHUNK_TIMESLICE_MS);
  }

  function stopSegmentCapture() {
    if (segmentLoopTimer !== null) {
      clearTimeout(segmentLoopTimer);
      segmentLoopTimer = null;
    }
    stopCurrentSegment(true);
  }

  async function startPushToTalk() {
    if (disposed || pushToTalkActive) return false;
    soundEngine?.unlock?.();
    pushToTalkActive = true;
    emitState();
    const stream = await ensureMicrophone();
    if (!stream || !pushToTalkActive) {
      pushToTalkActive = false;
      emitState();
      return false;
    }
    updateSpeakingFlag(true);
    startSegmentCapture();
    return true;
  }

  function stopPushToTalk() {
    if (!pushToTalkActive) return;
    pushToTalkActive = false;
    stopSegmentCapture();
    if (!openMic) {
      releaseMicrophoneIfIdle();
    } else {
      updateSpeakingFlag(false);
      startSegmentCapture();
    }
    emitState();
  }

  async function setOpenMic(nextOpen) {
    const want = Boolean(nextOpen);
    if (want === openMic) return openMic;
    soundEngine?.unlock?.();
    if (!want) {
      openMic = false;
      if (!pushToTalkActive) {
        releaseMicrophoneIfIdle();
      }
      emitState();
      return false;
    }
    openMic = true;
    emitState();
    const stream = await ensureMicrophone();
    if (!stream) {
      openMic = false;
      emitState();
      return false;
    }
    startSegmentCapture();
    return true;
  }

  function toggleOpenMic() {
    return setOpenMic(!openMic);
  }

  // ---------------- WebRTC P2P Direct Audio ----------------

  function attachLocalTrackToRtcPeers() {
    if (!micStream) return;
    const tracks = micStream.getAudioTracks();
    if (tracks.length === 0) return;
    for (const rec of rtcPeers.values()) {
      const senders = rec.pc.getSenders();
      const hasAudio = senders.some((s) => s.track && s.track.kind === "audio");
      if (!hasAudio) {
        for (const t of tracks) {
          try {
            rec.pc.addTrack(t, micStream);
          } catch {
            // ignore
          }
        }
      }
    }
  }

  function ensureRtcPeer(peerId) {
    if (!peerId || typeof RTCPeerConnection === "undefined") return null;
    let rec = rtcPeers.get(peerId);
    if (rec) return rec;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    rec = {
      id: peerId,
      pc,
      connected: false,
      makingOffer: false,
      pendingIce: [],
    };
    rtcPeers.set(peerId, rec);

    if (micStream) {
      for (const t of micStream.getAudioTracks()) {
        try {
          pc.addTrack(t, micStream);
        } catch {
          // ignore
        }
      }
    }

    pc.onicecandidate = (ev) => {
      if (disposed || !ev.candidate) return;
      const mp = getMp();
      mp?.sendVoiceSignal?.(peerId, "ice", ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate);
    };

    pc.ontrack = (ev) => {
      if (disposed) return;
      const stream = ev.streams?.[0] || new MediaStream([ev.track]);
      soundEngine?.attachPeerMediaStream?.(peerId, stream);
      const localPose = getLocalPose?.();
      const mix = computeSpatialAudioMix(localPose, null);
      soundEngine?.updatePeerSpatialMix?.(peerId, mix.pan, mix.gain);
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState || pc.iceConnectionState;
      rec.connected = st === "connected" || st === "completed";
      if (st === "failed" || st === "closed") {
        removeRtcPeer(peerId);
      }
      emitState();
    };

    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState;
      rec.connected = st === "connected" || st === "completed";
      emitState();
    };

    return rec;
  }

  function removeRtcPeer(peerId) {
    const rec = rtcPeers.get(peerId);
    if (!rec) return;
    rtcPeers.delete(peerId);
    soundEngine?.detachPeerMediaStream?.(peerId);
    try {
      rec.pc.close();
    } catch {
      // ignore
    }
    emitState();
  }

  async function syncPeers(peerIds = []) {
    if (disposed) return;
    const mp = getMp();
    const selfId = mp?.getSelfId?.();
    const activeSet = new Set(peerIds.map(String));

    for (const existingId of Array.from(rtcPeers.keys())) {
      if (!activeSet.has(existingId)) {
        removeRtcPeer(existingId);
      }
    }

    // Only initiate WebRTC when WebSocket transport is open (same direct-network environment)
    if (!mp || mp.getTransport?.() !== "ws" || !selfId || typeof RTCPeerConnection === "undefined") {
      return;
    }

    for (const peerId of activeSet) {
      if (!peerId || peerId === selfId) continue;
      if (rtcPeers.has(peerId)) continue;
      // Deterministic initiator rule prevents offer collision
      if (selfId < peerId) {
        const rec = ensureRtcPeer(peerId);
        if (!rec) continue;
        try {
          rec.makingOffer = true;
          const offer = await rec.pc.createOffer({ offerToReceiveAudio: true });
          await rec.pc.setLocalDescription(offer);
          mp.sendVoiceSignal?.(peerId, "offer", offer);
        } catch {
          // Hub clip relay covers this peer seamlessly
        } finally {
          rec.makingOffer = false;
        }
      }
    }
  }

  async function handleVoiceSignal(msg) {
    if (disposed || !msg || !msg.fromId || !msg.signalType) return;
    const peerId = String(msg.fromId);
    const mp = getMp();
    const selfId = mp?.getSelfId?.();
    if (!mp || peerId === selfId || typeof RTCPeerConnection === "undefined") return;

    const rec = ensureRtcPeer(peerId);
    if (!rec) return;
    const pc = rec.pc;

    try {
      if (msg.signalType === "offer" && msg.payload) {
        const polite = selfId > peerId;
        const offerCollision = rec.makingOffer || pc.signalingState !== "stable";
        if (offerCollision && !polite) return;
        await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
        if (micStream && pc.getSenders().length === 0) {
          for (const t of micStream.getAudioTracks()) {
            pc.addTrack(t, micStream);
          }
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        mp.sendVoiceSignal?.(peerId, "answer", answer);
        while (rec.pendingIce.length > 0) {
          const cand = rec.pendingIce.shift();
          await pc.addIceCandidate(cand);
        }
      } else if (msg.signalType === "answer" && msg.payload) {
        if (pc.signalingState !== "stable") {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
          while (rec.pendingIce.length > 0) {
            const cand = rec.pendingIce.shift();
            await pc.addIceCandidate(cand);
          }
        }
      } else if (msg.signalType === "ice" && msg.payload) {
        const cand = new RTCIceCandidate(msg.payload);
        if (pc.remoteDescription) {
          await pc.addIceCandidate(cand);
        } else {
          rec.pendingIce.push(cand);
        }
      }
    } catch {
      // Ignore malformed/stale signaling packets
    }
  }

  function markPeerSpeakingBriefly(peerId, durationMs = 1350) {
    if (!peerId) return;
    const prevTimer = peerSpeakingTimers.get(peerId);
    if (prevTimer) clearTimeout(prevTimer);
    onPeerSpeakingChange?.(peerId, true);
    const timer = setTimeout(() => {
      peerSpeakingTimers.delete(peerId);
      onPeerSpeakingChange?.(peerId, false);
    }, Math.max(700, Math.min(4500, durationMs)));
    peerSpeakingTimers.set(peerId, timer);
  }

  function handleIncomingVoiceClip(msg) {
    if (disposed || !msg || !msg.id || !msg.audioBase64) return;
    const peerId = String(msg.id);
    markPeerSpeakingBriefly(peerId, (Number(msg.durationMs) || 1000) + 320);

    // If direct WebRTC audio is live with this peer, skip duplicate clip playback
    const rtc = rtcPeers.get(peerId);
    if (rtc?.connected && micStream) {
      return;
    }

    const viewerPose = getLocalPose?.();
    const mix = computeSpatialAudioMix(viewerPose, {
      x: msg.x,
      z: msg.z,
      room: msg.room ?? null,
    });
    void soundEngine?.playRemoteVoiceClip?.({
      audioBase64: msg.audioBase64,
      mimeType: msg.mimeType || "audio/webm",
      pan: mix.pan,
      gain: mix.gain,
    });
  }

  function updateSpatialMix(viewerPose, peerSummaries = []) {
    if (disposed || !soundEngine?.updatePeerSpatialMix) return;
    for (const peer of peerSummaries) {
      if (!peer?.id || !rtcPeers.has(peer.id)) continue;
      const mix = computeSpatialAudioMix(viewerPose, peer);
      soundEngine.updatePeerSpatialMix(peer.id, mix.pan, mix.gain);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    openMic = false;
    pushToTalkActive = false;
    stopSegmentCapture();
    stopMeterLoop();
    for (const timer of peerSpeakingTimers.values()) {
      clearTimeout(timer);
    }
    peerSpeakingTimers.clear();
    for (const peerId of Array.from(rtcPeers.keys())) {
      removeRtcPeer(peerId);
    }
    if (micStream) {
      for (const track of micStream.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
      micStream = null;
    }
  }

  return {
    getState,
    startPushToTalk,
    stopPushToTalk,
    setOpenMic,
    toggleOpenMic,
    syncPeers,
    handleVoiceSignal,
    handleIncomingVoiceClip,
    updateSpatialMix,
    dispose,
  };
}

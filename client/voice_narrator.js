// Client-side AI Voice-Over Manager backed by server-side Gemini TTS (/api/voice-over).

const VOICE_ENABLED_KEY = "geminisland_voice_enabled_v1";
const MAX_LOCAL_CACHE = 24;

function loadVoiceEnabled() {
  try {
    if (typeof localStorage === "undefined") return true;
    const raw = localStorage.getItem(VOICE_ENABLED_KEY);
    if (raw === "0" || raw === "false") return false;
    return true;
  } catch {
    return true;
  }
}

function saveVoiceEnabled(val) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(VOICE_ENABLED_KEY, val ? "1" : "0");
    }
  } catch {
    // Ignore storage restrictions
  }
}

const SPEECH_PITCH_MAP = Object.freeze({
  Kore: 1.06,
  Puck: 1.18,
  Zephyr: 1.0,
  Fenrir: 0.85,
  Charon: 0.76,
});

const PERSONA_DEFAULT_VOICE = Object.freeze({
  gps: "Kore",
  dispatch: "Zephyr",
  villager: "Puck",
  race: "Fenrir",
  player: "Puck",
});

export function createVoiceNarrator(options = {}) {
  const { getHeaders, onVisitorToken, onStateChange } = options;

  let enabled = loadVoiceEnabled();
  let loading = false;
  let speaking = false;
  let needsUnlock = false;
  let lastText = "";
  let lastPersona = "gps";
  let lastVoiceName = "";
  let lastSpeakerLabel = "GPS Nav";
  let lastError = "";
  let lastAudioSrc = "";

  let activeAudio = null;
  let activeAbort = null;
  let playSeq = 0;

  const audioCache = new Map();

  function getState() {
    return {
      enabled,
      loading,
      speaking,
      needsUnlock,
      lastText,
      lastPersona,
      lastVoiceName,
      lastSpeakerLabel,
      lastError,
      hasReplay: Boolean(lastAudioSrc || lastText),
    };
  }

  function emit() {
    onStateChange?.(getState());
  }

  function stopBrowserSpeech() {
    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // Ignore speechSynthesis teardown errors
    }
  }

  function stopPlaybackOnly() {
    if (activeAudio) {
      try {
        activeAudio.pause();
        activeAudio.currentTime = 0;
      } catch {
        // Ignore audio element teardown errors
      }
      activeAudio = null;
    }
    stopBrowserSpeech();
    speaking = false;
  }

  function stop() {
    playSeq += 1;
    if (activeAbort) {
      try {
        activeAbort.abort();
      } catch {
        // Ignore abort errors
      }
      activeAbort = null;
    }
    loading = false;
    needsUnlock = false;
    stopPlaybackOnly();
    emit();
  }

  function speakWithBrowserFallback(text, persona, voiceName, seq) {
    if (
      typeof window === "undefined" ||
      typeof SpeechSynthesisUtterance === "undefined" ||
      !window.speechSynthesis
    ) {
      return null;
    }

    stopPlaybackOnly();
    return new Promise((resolve) => {
      let settled = false;
      const done = (res) => {
        if (settled) return;
        settled = true;
        clearTimeout(safetyTimer);
        if (seq === playSeq) {
          speaking = false;
          emit();
        }
        resolve(res);
      };

      const safetyTimer = setTimeout(() => {
        done({ ok: true, fallback: "speech_synthesis" });
      }, 12_000);

      try {
        const utter = new SpeechSynthesisUtterance(text);
        const effVoice = voiceName || PERSONA_DEFAULT_VOICE[persona] || "Kore";
        utter.pitch = SPEECH_PITCH_MAP[effVoice] ?? 1.0;
        utter.rate = persona === "race" ? 1.1 : persona === "gps" ? 1.03 : 1.0;
        utter.volume = 0.85;

        const voices = window.speechSynthesis.getVoices?.() || [];
        const enVoices = voices.filter((v) => /^en/i.test(v.lang));
        if (enVoices.length > 0) {
          const idxSeed = effVoice.charCodeAt(0) + effVoice.charCodeAt(effVoice.length - 1);
          utter.voice = enVoices[idxSeed % enVoices.length];
        }

        utter.onstart = () => {
          if (seq !== playSeq) return;
          speaking = true;
          lastError = "";
          needsUnlock = false;
          emit();
        };
        utter.onend = () => done({ ok: true, fallback: "speech_synthesis" });
        utter.onerror = () => done({ ok: false, error: "Speech playback failed" });

        window.speechSynthesis.speak(utter);
        if (seq === playSeq) {
          speaking = true;
          lastError = "";
          emit();
        }
      } catch {
        done({ ok: false, error: "Browser speech unavailable" });
      }
    });
  }

  async function playDataUrl(dataUrl, seq) {
    stopPlaybackOnly();
    const audio = new Audio(dataUrl);
    activeAudio = audio;
    lastAudioSrc = dataUrl;
    needsUnlock = false;

    return new Promise((resolve) => {
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        if (activeAudio === audio) {
          activeAudio = null;
        }
        if (seq === playSeq) {
          speaking = false;
          emit();
        }
        resolve(result);
      };

      audio.onended = () => done({ ok: true });
      audio.onerror = () => {
        if (seq === playSeq) {
          lastError = "Audio playback failed";
        }
        done({ ok: false, error: "Audio playback failed" });
      };

      try {
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.then === "function") {
          playPromise
            .then(() => {
              if (seq !== playSeq) {
                try {
                  audio.pause();
                } catch {
                  // Ignore
                }
                done({ ok: false, superseded: true });
                return;
              }
              speaking = true;
              lastError = "";
              needsUnlock = false;
              emit();
            })
            .catch((err) => {
              const name = String(err?.name || "");
              if (seq === playSeq) {
                if (name === "NotAllowedError" || /notallowed|interact|gesture/i.test(String(err?.message || ""))) {
                  needsUnlock = true;
                  lastError = "Tap Listen to play voice";
                } else {
                  lastError = "Audio blocked in browser";
                }
              }
              done({ ok: false, blocked: true });
            });
        } else {
          speaking = true;
          emit();
        }
      } catch {
        if (seq === playSeq) {
          needsUnlock = true;
          lastError = "Tap Listen to play voice";
        }
        done({ ok: false, blocked: true });
      }
    });
  }

  async function speak(rawText, opts = {}) {
    const cleanText = String(rawText ?? "").replace(/\s+/g, " ").trim().slice(0, 320);
    if (!cleanText) return { ok: false, error: "Empty voice cue" };

    const persona = opts.persona || "gps";
    const voiceName = typeof opts.voiceName === "string" ? opts.voiceName.trim() : "";
    const speakerLabel =
      opts.speakerLabel ||
      (persona === "dispatch"
        ? "Officer Sunny"
        : persona === "villager"
          ? "Villager"
          : persona === "race"
            ? "Race Chief"
            : persona === "player"
              ? "Explorer"
              : "GPS Nav");
    const force = Boolean(opts.force);

    lastText = cleanText;
    lastPersona = persona;
    lastVoiceName = voiceName;
    lastSpeakerLabel = speakerLabel;

    if (!enabled && !force) {
      lastError = "";
      emit();
      return { ok: false, skipped: true };
    }

    if (activeAbort) {
      try {
        activeAbort.abort();
      } catch {
        // Ignore
      }
      activeAbort = null;
    }
    stopPlaybackOnly();

    const seq = ++playSeq;
    const cacheKey = `${persona}:${voiceName}:${cleanText}`;
    const cachedUrl = audioCache.get(cacheKey);
    if (cachedUrl) {
      loading = false;
      lastError = "";
      emit();
      return playDataUrl(cachedUrl, seq);
    }

    loading = true;
    lastError = "";
    needsUnlock = false;
    emit();

    const controller = new AbortController();
    activeAbort = controller;

    try {
      const headers =
        typeof getHeaders === "function"
          ? getHeaders({
              "content-type": "application/json",
              "x-meadow-client": "1",
            })
          : {
              "content-type": "application/json",
              "x-meadow-client": "1",
            };

      const res = await fetch("/api/voice-over", {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          text: cleanText,
          persona,
          ...(voiceName ? { voiceName } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (data?.visitorToken) {
        onVisitorToken?.(data.visitorToken);
      }

      if (seq !== playSeq) {
        return { ok: false, superseded: true };
      }
      if (activeAbort === controller) {
        activeAbort = null;
      }
      loading = false;

      if (!res.ok || !data?.ok || !data?.audioBase64) {
        lastAudioSrc = "";
        const fallbackPromise = speakWithBrowserFallback(cleanText, persona, voiceName, seq);
        if (fallbackPromise) {
          lastError = "";
          emit();
          return fallbackPromise;
        }
        lastError = data?.error || "AI voice-over unavailable right now";
        emit();
        return { ok: false, error: lastError };
      }

      const dataUrl = `data:${data.mimeType || "audio/wav"};base64,${data.audioBase64}`;
      if (audioCache.size >= MAX_LOCAL_CACHE) {
        const oldestKey = audioCache.keys().next().value;
        if (oldestKey) audioCache.delete(oldestKey);
      }
      audioCache.set(cacheKey, dataUrl);
      lastAudioSrc = dataUrl;
      emit();

      return playDataUrl(dataUrl, seq);
    } catch (err) {
      if (err?.name === "AbortError" || seq !== playSeq) {
        return { ok: false, aborted: true };
      }
      if (activeAbort === controller) {
        activeAbort = null;
      }
      loading = false;
      const fallbackPromise = speakWithBrowserFallback(cleanText, persona, voiceName, seq);
      if (fallbackPromise) {
        lastError = "";
        emit();
        return fallbackPromise;
      }
      speaking = false;
      lastError = "Network hiccup reaching AI Voice";
      emit();
      return { ok: false, error: lastError };
    }
  }

  async function replayLast() {
    if (lastAudioSrc) {
      const seq = ++playSeq;
      loading = false;
      lastError = "";
      emit();
      return playDataUrl(lastAudioSrc, seq);
    }
    if (lastText) {
      return speak(lastText, {
        persona: lastPersona,
        speakerLabel: lastSpeakerLabel,
        force: true,
      });
    }
    return { ok: false, error: "Nothing to play yet" };
  }

  function setEnabled(next) {
    enabled = Boolean(next);
    saveVoiceEnabled(enabled);
    if (!enabled) {
      stop();
    } else {
      lastError = "";
      emit();
    }
    return enabled;
  }

  function toggle() {
    return setEnabled(!enabled);
  }

  return {
    speak,
    replayLast,
    stop,
    setEnabled,
    toggle,
    getState,
  };
}

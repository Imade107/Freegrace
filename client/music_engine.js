// GeminIsland Adaptive Web Audio Background Music Engine.
// Composes lush, seamless looping soundtracks that adapt in real time to world weather,
// indoor spaces, Grand Prix racing, police pursuits/heists, and player/AI voice ducking.

const MUSIC_ENABLED_KEY = "geminisland_music_enabled_v1";
const MUSIC_VOLUME_KEY = "geminisland_music_volume_v1";
const MUSIC_STATION_KEY = "geminisland_music_station_v1";

export const MUSIC_STATIONS = Object.freeze([
  { id: "auto", label: "Auto · Dynamic World" },
  { id: "meadow", label: "Sunlit Island Breeze" },
  { id: "lofi", label: "Rainy Lo-Fi Rhodes" },
  { id: "ambient", label: "Winter Celesta" },
  { id: "synthwave", label: "Grand Prix Synthwave" },
  { id: "chase", label: "Patrol Midnight Groove" },
]);

const VALID_STATIONS = new Set(MUSIC_STATIONS.map((s) => s.id));

function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function loadMusicEnabled() {
  try {
    if (typeof localStorage === "undefined") return true;
    const raw = localStorage.getItem(MUSIC_ENABLED_KEY);
    return raw !== "0" && raw !== "false";
  } catch {
    return true;
  }
}

function saveMusicEnabled(enabled) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(MUSIC_ENABLED_KEY, enabled ? "1" : "0");
    }
  } catch {
    // Ignore storage restrictions
  }
}

function loadMusicVolume() {
  try {
    if (typeof localStorage === "undefined") return 0.44;
    const raw = Number(localStorage.getItem(MUSIC_VOLUME_KEY));
    return Number.isFinite(raw) ? Math.max(0.05, Math.min(1, raw)) : 0.44;
  } catch {
    return 0.44;
  }
}

function saveMusicVolume(vol) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(MUSIC_VOLUME_KEY, String(Math.round(vol * 100) / 100));
    }
  } catch {
    // Ignore storage restrictions
  }
}

function loadMusicStation() {
  try {
    if (typeof localStorage === "undefined") return "auto";
    const s = localStorage.getItem(MUSIC_STATION_KEY);
    return s && VALID_STATIONS.has(s) ? s : "auto";
  } catch {
    return "auto";
  }
}

function saveMusicStation(station) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(MUSIC_STATION_KEY, station);
    }
  } catch {
    // Ignore storage restrictions
  }
}

// 4-bar progressions (each bar = 16 sixteenth steps)
const THEMES = {
  meadow: {
    id: "meadow",
    title: "Sunlit Island Breeze",
    bpm: 86,
    chords: [
      { bass: 41, pad: [65, 69, 72, 76], scale: [72, 74, 76, 79, 81, 84] }, // Fmaj7
      { bass: 43, pad: [67, 71, 74, 76], scale: [74, 76, 79, 81, 83, 86] }, // G6
      { bass: 40, pad: [64, 67, 71, 74], scale: [71, 72, 74, 76, 79, 83] }, // Em7
      { bass: 45, pad: [64, 67, 72, 76], scale: [72, 74, 76, 79, 81, 84] }, // Am7/9
    ],
    leadVoice: "marimba",
    melodySteps: [0, 3, 6, 8, 11, 14],
    melodyOffsets: [0, 2, 3, 4, 2, 1],
    bassPattern: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    kickSteps: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snareSteps: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hatSteps: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
    drumLevel: 0.42,
  },
  lofi: {
    id: "lofi",
    title: "Rainy Lo-Fi Rhodes",
    bpm: 74,
    chords: [
      { bass: 45, pad: [64, 67, 71, 72], scale: [72, 74, 76, 79, 81] }, // Am9
      { bass: 38, pad: [62, 65, 69, 72], scale: [69, 72, 74, 76, 79] }, // Dm9
      { bass: 43, pad: [65, 69, 71, 74], scale: [71, 74, 76, 79, 81] }, // G13
      { bass: 48, pad: [64, 67, 71, 74], scale: [72, 74, 76, 79, 83] }, // Cmaj9
    ],
    leadVoice: "rhodes",
    melodySteps: [0, 4, 7, 10, 13],
    melodyOffsets: [1, 3, 4, 2, 0],
    bassPattern: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
    kickSteps: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
    snareSteps: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hatSteps: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    drumLevel: 0.48,
  },
  ambient: {
    id: "ambient",
    title: "Winter Celesta",
    bpm: 76,
    chords: [
      { bass: 48, pad: [64, 67, 71, 74], scale: [76, 79, 81, 83, 86, 88] }, // Cmaj9
      { bass: 41, pad: [64, 69, 72, 76], scale: [76, 79, 81, 84, 88, 91] }, // Fmaj7
      { bass: 45, pad: [64, 67, 72, 74], scale: [74, 76, 79, 83, 84, 88] }, // Am11
      { bass: 43, pad: [62, 67, 71, 74], scale: [74, 76, 79, 81, 83, 86] }, // G6
    ],
    leadVoice: "celesta",
    melodySteps: [0, 2, 6, 8, 12, 14],
    melodyOffsets: [0, 2, 4, 3, 5, 1],
    bassPattern: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    kickSteps: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    snareSteps: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    hatSteps: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    drumLevel: 0.22,
  },
  synthwave: {
    id: "synthwave",
    title: "Grand Prix Synthwave",
    bpm: 124,
    chords: [
      { bass: 42, pad: [61, 66, 69, 73], scale: [69, 73, 76, 78, 81, 85] }, // F#m7
      { bass: 38, pad: [62, 66, 69, 73], scale: [69, 73, 74, 78, 81, 86] }, // Dmaj7
      { bass: 40, pad: [64, 68, 71, 76], scale: [71, 74, 76, 80, 83, 88] }, // E6
      { bass: 49, pad: [61, 64, 68, 73], scale: [71, 73, 76, 80, 83, 85] }, // C#m7
    ],
    leadVoice: "synth",
    melodySteps: [0, 2, 4, 6, 8, 10, 12, 14],
    melodyOffsets: [0, 2, 4, 2, 5, 3, 4, 1],
    bassPattern: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    kickSteps: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snareSteps: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hatSteps: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
    drumLevel: 0.65,
  },
  chase: {
    id: "chase",
    title: "Patrol Midnight Groove",
    bpm: 112,
    chords: [
      { bass: 38, pad: [62, 65, 69, 72], scale: [69, 72, 74, 77, 81] }, // Dm7
      { bass: 46, pad: [62, 65, 69, 70], scale: [70, 72, 74, 77, 81] }, // Bbmaj7
      { bass: 43, pad: [62, 65, 67, 70], scale: [67, 70, 72, 74, 79] }, // Gm7
      { bass: 45, pad: [62, 64, 67, 69], scale: [69, 72, 74, 76, 81] }, // A7sus4
    ],
    leadVoice: "pluck",
    melodySteps: [0, 3, 6, 10, 12, 15],
    melodyOffsets: [0, 2, 3, 4, 1, 2],
    bassPattern: [1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0],
    kickSteps: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
    snareSteps: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hatSteps: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    drumLevel: 0.58,
  },
};

export function createBackgroundMusicEngine(options = {}) {
  const { getAudioGraph, unlockAudio, onStateChange } = options;

  let enabled = loadMusicEnabled();
  let volume = loadMusicVolume();
  let station = loadMusicStation();
  let activeThemeId = "meadow";
  let isInside = false;
  let isDucked = false;
  let disposed = false;

  // Audio graph nodes lazily bound to shared AudioContext
  let boundCtx = null;
  let musicBus = null;
  let musicDuckGain = null;
  let musicFilter = null;
  let melodyEchoSend = null;
  let hihatNoiseBuf = null;

  // Lookahead sequencer state
  let seqTimer = null;
  let nextStepTime = 0;
  let stepIndex = 0;
  let barIndex = 0;
  let worldSnapshot = {
    weatherMode: "clear",
    isRacing: false,
    isInside: false,
    wantedStars: 0,
    activeRobbery: false,
  };

  function getActiveTheme() {
    return THEMES[activeThemeId] || THEMES.meadow;
  }

  function resolveAutoTheme(snap) {
    if (snap.isRacing) return "synthwave";
    if ((Number(snap.wantedStars) || 0) > 0 || snap.activeRobbery) return "chase";
    if (snap.weatherMode === "rain") return "lofi";
    if (snap.weatherMode === "snow") return "ambient";
    return "meadow";
  }

  function getState() {
    const t = getActiveTheme();
    return {
      enabled,
      volume,
      station,
      activeThemeId: t.id,
      activeThemeTitle: t.title,
      isDucked,
      isInside,
      playing: Boolean(enabled && boundCtx && boundCtx.state === "running"),
    };
  }

  function emit() {
    onStateChange?.(getState());
  }

  function createHihatNoise(ctx) {
    const len = Math.floor(ctx.sampleRate * 0.25);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  function ensureGraph() {
    if (disposed) return false;
    const graph = getAudioGraph?.();
    if (!graph || !graph.ctx || !graph.masterGain) return false;
    const { ctx, masterGain } = graph;
    if (ctx.state !== "running") return false;

    if (boundCtx === ctx && musicBus) {
      return true;
    }

    try {
      boundCtx = ctx;
      musicBus = ctx.createGain();
      musicBus.gain.value = enabled ? volume * 0.65 : 0;
      musicBus.connect(masterGain);

      musicDuckGain = ctx.createGain();
      musicDuckGain.gain.value = isDucked ? 0.36 : 1.0;
      musicDuckGain.connect(musicBus);

      musicFilter = ctx.createBiquadFilter();
      musicFilter.type = "lowpass";
      musicFilter.frequency.value = isInside ? 1650 : 4400;
      musicFilter.Q.value = 0.6;
      musicFilter.connect(musicDuckGain);

      // Stereo dotted-eighth delay send for melody warmth
      const delayL = ctx.createDelay(1.0);
      delayL.delayTime.value = 0.28;
      const delayR = ctx.createDelay(1.0);
      delayR.delayTime.value = 0.42;
      const fbL = ctx.createGain();
      fbL.gain.value = 0.22;
      const fbR = ctx.createGain();
      fbR.gain.value = 0.20;
      const echoWet = ctx.createGain();
      echoWet.gain.value = 0.22;

      const echoFilter = ctx.createBiquadFilter();
      echoFilter.type = "lowpass";
      echoFilter.frequency.value = 2100;

      melodyEchoSend = ctx.createGain();
      melodyEchoSend.gain.value = 1.0;

      melodyEchoSend.connect(delayL);
      melodyEchoSend.connect(delayR);
      delayL.connect(fbL);
      fbL.connect(delayR);
      delayR.connect(fbR);
      fbR.connect(delayL);
      delayL.connect(echoFilter);
      delayR.connect(echoFilter);
      echoFilter.connect(echoWet);
      echoWet.connect(musicFilter);

      hihatNoiseBuf = createHihatNoise(ctx);
      nextStepTime = ctx.currentTime + 0.08;
      emit();
      return true;
    } catch {
      return false;
    }
  }

  function applyGainsSmooth() {
    if (!boundCtx || !musicBus || !musicDuckGain || !musicFilter) return;
    const now = boundCtx.currentTime;
    const targetBus = enabled ? volume * 0.65 : 0;
    musicBus.gain.setTargetAtTime(targetBus, now, 0.14);
    musicDuckGain.gain.setTargetAtTime(isDucked ? 0.36 : 1.0, now, 0.18);
    musicFilter.frequency.setTargetAtTime(isInside ? 1650 : 4400, now, 0.22);
  }

  // ---------------- Musical Voices ----------------

  function triggerPadChord(ctx, notes, time, durSec, voiceType) {
    if (!notes || notes.length === 0) return;
    const perNoteGain = 0.042 / Math.sqrt(notes.length);
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = voiceType === "synthwave" ? "sawtooth" : i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(midiToHz(notes[i]), time);
      if (voiceType === "lofi") {
        osc.detune.setValueAtTime((i % 2 === 0 ? -1 : 1) * 5, time);
      }

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(voiceType === "synthwave" ? 1350 : 1150, time);

      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(perNoteGain, time + Math.min(0.45, durSec * 0.25));
      g.gain.exponentialRampToValueAtTime(perNoteGain * 0.72, time + durSec * 0.75);
      g.gain.exponentialRampToValueAtTime(0.0001, time + durSec);

      osc.connect(lp);
      lp.connect(g);
      g.connect(musicFilter);
      osc.start(time);
      osc.stop(time + durSec + 0.04);
    }
  }

  function triggerBassNote(ctx, midi, time, durSec, isDriving) {
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();

    osc.type = isDriving ? "sawtooth" : "triangle";
    osc.frequency.setValueAtTime(midiToHz(midi), time);

    lp.type = "lowpass";
    lp.frequency.setValueAtTime(isDriving ? 560 : 320, time);
    lp.frequency.exponentialRampToValueAtTime(isDriving ? 220 : 160, time + durSec);

    const peak = isDriving ? 0.13 : 0.11;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(peak, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + durSec);

    osc.connect(lp);
    lp.connect(g);
    g.connect(musicFilter);
    osc.start(time);
    osc.stop(time + durSec + 0.03);
  }

  function triggerLeadNote(ctx, midi, time, durSec, voice) {
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const g = ctx.createGain();

    const hz = midiToHz(midi);
    if (voice === "celesta") {
      osc.type = "sine";
      overtone.type = "sine";
      osc.frequency.setValueAtTime(hz, time);
      overtone.frequency.setValueAtTime(hz * 2, time);
    } else if (voice === "synth") {
      osc.type = "triangle";
      overtone.type = "sawtooth";
      osc.frequency.setValueAtTime(hz, time);
      overtone.frequency.setValueAtTime(hz, time);
      overtone.detune.setValueAtTime(7, time);
    } else if (voice === "rhodes") {
      osc.type = "sine";
      overtone.type = "triangle";
      osc.frequency.setValueAtTime(hz, time);
      overtone.frequency.setValueAtTime(hz * 2, time);
    } else {
      // marimba / pluck
      osc.type = "sine";
      overtone.type = "triangle";
      osc.frequency.setValueAtTime(hz, time);
      overtone.frequency.setValueAtTime(hz * 2.0, time);
    }

    const overGain = ctx.createGain();
    overGain.gain.setValueAtTime(voice === "synth" ? 0.25 : 0.16, time);
    overGain.gain.exponentialRampToValueAtTime(0.001, time + durSec * 0.45);

    const peak = voice === "celesta" ? 0.065 : voice === "synth" ? 0.07 : 0.075;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(peak, time + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, time + durSec);

    osc.connect(g);
    overtone.connect(overGain);
    overGain.connect(g);
    g.connect(musicFilter);
    if (melodyEchoSend) g.connect(melodyEchoSend);

    osc.start(time);
    overtone.start(time);
    osc.stop(time + durSec + 0.05);
    overtone.stop(time + durSec + 0.05);
  }

  function triggerDrum(ctx, kind, time, level = 0.45) {
    if (kind === "kick") {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(118, time);
      osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);
      g.gain.setValueAtTime(0.16 * level, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
      osc.connect(g);
      g.connect(musicFilter);
      osc.start(time);
      osc.stop(time + 0.18);
    } else if (kind === "snare" && hihatNoiseBuf) {
      const src = ctx.createBufferSource();
      src.buffer = hihatNoiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(1450, time);
      bp.Q.value = 0.85;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.075 * level, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.11);
      src.connect(bp);
      bp.connect(g);
      g.connect(musicFilter);
      src.start(time);
      src.stop(time + 0.12);
    } else if (kind === "hat" && hihatNoiseBuf) {
      const src = ctx.createBufferSource();
      src.buffer = hihatNoiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(6200, time);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.036 * level, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
      src.connect(hp);
      hp.connect(g);
      g.connect(musicFilter);
      src.start(time);
      src.stop(time + 0.055);
    }
  }

  function scheduleStep(time, step, bar, theme) {
    const ctx = boundCtx;
    if (!ctx || !musicFilter) return;

    const chord = theme.chords[bar % theme.chords.length];
    const stepDur = 60 / theme.bpm / 4; // sixteenth note duration

    // Bar start: warm harmonic pad
    if (step === 0) {
      triggerPadChord(ctx, chord.pad, time, stepDur * 15.5, theme.id);
    }

    // Bass groove
    if (theme.bassPattern[step]) {
      const oct = theme.id === "synthwave" && step % 2 === 1 ? 12 : 0;
      const dur = theme.id === "synthwave" ? stepDur * 0.85 : stepDur * 2.2;
      triggerBassNote(ctx, chord.bass + oct, time, dur, theme.id === "synthwave" || theme.id === "chase");
    }

    // Melodic phrasing (with light bar-to-bar variation so loops feel alive)
    const melIdx = theme.melodySteps.indexOf(step);
    if (melIdx >= 0) {
      const baseOff = theme.melodyOffsets[melIdx] || 0;
      const varOff = (bar % 4 === 3 && melIdx % 2 === 1) ? 1 : (bar % 2 === 1 && melIdx === 2) ? -1 : 0;
      const scaleIdx = Math.max(0, Math.min(chord.scale.length - 1, baseOff + varOff));
      const note = chord.scale[scaleIdx];
      const dur = theme.id === "ambient" ? stepDur * 5.2 : theme.id === "synthwave" ? stepDur * 1.4 : stepDur * 2.8;
      triggerLeadNote(ctx, note, time, dur, theme.leadVoice);
    }

    // Percussion
    if (theme.kickSteps[step]) triggerDrum(ctx, "kick", time, theme.drumLevel);
    if (theme.snareSteps[step]) triggerDrum(ctx, "snare", time, theme.drumLevel);
    if (theme.hatSteps[step]) triggerDrum(ctx, "hat", time, theme.drumLevel);
  }

  function tickScheduler() {
    if (disposed || !enabled) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    if (!ensureGraph()) return;

    const ctx = boundCtx;
    if (!ctx || ctx.state !== "running") return;

    const theme = getActiveTheme();
    const stepDur = 60 / theme.bpm / 4;

    if (nextStepTime < ctx.currentTime - 0.15) {
      nextStepTime = ctx.currentTime + 0.05;
    }

    while (nextStepTime < ctx.currentTime + 0.18) {
      scheduleStep(nextStepTime, stepIndex, barIndex, theme);
      nextStepTime += stepDur;
      stepIndex += 1;
      if (stepIndex >= 16) {
        stepIndex = 0;
        barIndex = (barIndex + 1) % 4;
      }
    }
  }

  function startScheduler() {
    if (seqTimer !== null || disposed) return;
    seqTimer = setInterval(tickScheduler, 70);
  }

  function stopScheduler() {
    if (seqTimer !== null) {
      clearInterval(seqTimer);
      seqTimer = null;
    }
  }

  if (enabled) {
    startScheduler();
  }

  // ---------------- Public Controls ----------------

  function syncFromUnlock() {
    if (!enabled) return;
    if (ensureGraph()) {
      applyGainsSmooth();
      startScheduler();
    }
  }

  function setEnabled(next) {
    enabled = Boolean(next);
    saveMusicEnabled(enabled);
    if (enabled) {
      unlockAudio?.();
      ensureGraph();
      startScheduler();
    } else {
      stopScheduler();
    }
    applyGainsSmooth();
    emit();
    return enabled;
  }

  function toggle() {
    return setEnabled(!enabled);
  }

  function setVolume(nextVol) {
    const clean = Math.max(0.05, Math.min(1, Number(nextVol) || 0.44));
    volume = clean;
    saveMusicVolume(clean);
    applyGainsSmooth();
    emit();
    return volume;
  }

  function setStation(nextStation) {
    const clean = VALID_STATIONS.has(nextStation) ? nextStation : "auto";
    station = clean;
    saveMusicStation(clean);
    const nextTheme = clean === "auto" ? resolveAutoTheme(worldSnapshot) : clean;
    if (nextTheme !== activeThemeId) {
      activeThemeId = nextTheme;
      stepIndex = 0;
    }
    emit();
    return station;
  }

  function setDucked(ducked) {
    const clean = Boolean(ducked);
    if (clean === isDucked) return;
    isDucked = clean;
    applyGainsSmooth();
  }

  function updateWorldState(snap = {}) {
    worldSnapshot = {
      weatherMode: snap.weatherMode || "clear",
      isRacing: Boolean(snap.isRacing),
      isInside: Boolean(snap.isInside),
      wantedStars: Number(snap.wantedStars) || 0,
      activeRobbery: Boolean(snap.activeRobbery),
    };

    let changed = false;
    if (worldSnapshot.isInside !== isInside) {
      isInside = worldSnapshot.isInside;
      applyGainsSmooth();
      changed = true;
    }

    const desiredTheme = station === "auto" ? resolveAutoTheme(worldSnapshot) : station;
    if (desiredTheme !== activeThemeId && THEMES[desiredTheme]) {
      activeThemeId = desiredTheme;
      stepIndex = 0;
      changed = true;
    }

    if (enabled && !boundCtx) {
      ensureGraph();
    }

    if (changed) {
      emit();
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stopScheduler();
    try {
      melodyEchoSend?.disconnect();
      musicFilter?.disconnect();
      musicDuckGain?.disconnect();
      musicBus?.disconnect();
    } catch {
      // Ignore cleanup errors
    }
    boundCtx = null;
    musicBus = null;
  }

  return {
    getState,
    syncFromUnlock,
    setEnabled,
    toggle,
    setVolume,
    setStation,
    setDucked,
    updateWorldState,
    dispose,
  };
}

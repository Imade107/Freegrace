// GeminIsland Web Audio World Sound Engine & Spatial Player Voice Mixer.
// Synthesizes cohesive ambient soundscapes (meadow breeze, rain, winter wind),
// surface footsteps, vehicle engines/sirens, heist alarms, mini-game/shop chimes,
// expressive player emote voices, and 3D spatialized multiplayer player voices.

const SOUND_ENABLED_KEY = "geminisland_sound_enabled_v1";
const SOUND_VOLUME_KEY = "geminisland_sound_volume_v1";

const VOICE_PITCH_MAP = Object.freeze({
  Kore: 1.06,
  Puck: 1.18,
  Zephyr: 1.0,
  Fenrir: 0.84,
  Charon: 0.76,
});

function loadSoundEnabled() {
  try {
    if (typeof localStorage === "undefined") return true;
    const raw = localStorage.getItem(SOUND_ENABLED_KEY);
    return raw !== "0" && raw !== "false";
  } catch {
    return true;
  }
}

function saveSoundEnabled(enabled) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SOUND_ENABLED_KEY, enabled ? "1" : "0");
    }
  } catch {
    // Ignore private-mode storage restrictions
  }
}

function loadMasterVolume() {
  try {
    if (typeof localStorage === "undefined") return 0.72;
    const raw = Number(localStorage.getItem(SOUND_VOLUME_KEY));
    return Number.isFinite(raw) ? Math.max(0.05, Math.min(1, raw)) : 0.72;
  } catch {
    return 0.72;
  }
}

function saveMasterVolume(vol) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SOUND_VOLUME_KEY, String(Math.round(vol * 100) / 100));
    }
  } catch {
    // Ignore storage restrictions
  }
}

function decodeBase64ToUint8(base64Str) {
  const binStr = atob(base64Str);
  const len = binStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes;
}

export function createSoundEngine(options = {}) {
  const { onStateChange } = options;

  let enabled = loadSoundEnabled();
  let volume = loadMasterVolume();
  let unlocked = false;

  let ctx = null;
  let masterGain = null;
  let ambientBus = null;
  let ambientIndoorFilter = null;
  let sfxBus = null;
  let voiceBus = null;
  let sharedNoiseBuf = null;

  // Continuous atmospheric & vehicle nodes
  let breezeSrc = null;
  let breezeGain = null;
  let rainSrc = null;
  let rainGain = null;
  let snowSrc = null;
  let snowFilter = null;
  let snowGain = null;

  let engineOscA = null;
  let engineOscB = null;
  let engineFilter = null;
  let engineGain = null;
  let nitroSrc = null;
  let nitroGain = null;

  let sirenOsc = null;
  let sirenGain = null;
  let sirenPan = null;

  let nextRainDropAt = 0;
  let lastHeistSoundAt = 0;
  const peerStreams = new Map();

  function getState() {
    return {
      enabled,
      volume,
      unlocked,
    };
  }

  function emit() {
    onStateChange?.(getState());
  }

  function applyMasterGain() {
    if (!ctx || !masterGain) return;
    const target = enabled ? volume : 0;
    try {
      masterGain.gain.setTargetAtTime(target, ctx.currentTime, 0.045);
    } catch {
      masterGain.gain.value = target;
    }
  }

  function buildNoiseBuffer(audioCtx, sec = 2.0) {
    const sampleRate = audioCtx.sampleRate;
    const length = Math.max(4096, Math.floor(sampleRate * sec));
    const buf = audioCtx.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.95 * b2 + white * 0.048;
        data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.14) * 0.35));
      }
    }
    return buf;
  }

  function initContinuousLoops(audioCtx) {
    if (breezeSrc) return;
    sharedNoiseBuf = buildNoiseBuffer(audioCtx, 2.5);

    // 1. Ambient breeze + surf bed
    breezeSrc = audioCtx.createBufferSource();
    breezeSrc.buffer = sharedNoiseBuf;
    breezeSrc.loop = true;
    const breezeFilter = audioCtx.createBiquadFilter();
    breezeFilter.type = "lowpass";
    breezeFilter.frequency.value = 520;
    breezeGain = audioCtx.createGain();
    breezeGain.gain.value = 0.055;
    breezeSrc.connect(breezeFilter);
    breezeFilter.connect(breezeGain);
    breezeGain.connect(ambientIndoorFilter);
    breezeSrc.start();

    // 2. Rain shower patter loop
    rainSrc = audioCtx.createBufferSource();
    rainSrc.buffer = sharedNoiseBuf;
    rainSrc.loop = true;
    const rainBand = audioCtx.createBiquadFilter();
    rainBand.type = "bandpass";
    rainBand.frequency.value = 1850;
    rainBand.Q.value = 0.65;
    rainGain = audioCtx.createGain();
    rainGain.gain.value = 0.0;
    rainSrc.connect(rainBand);
    rainBand.connect(rainGain);
    rainGain.connect(ambientIndoorFilter);
    rainSrc.start();

    // 3. Winter wind loop
    snowSrc = audioCtx.createBufferSource();
    snowSrc.buffer = sharedNoiseBuf;
    snowSrc.loop = true;
    snowFilter = audioCtx.createBiquadFilter();
    snowFilter.type = "bandpass";
    snowFilter.frequency.value = 460;
    snowFilter.Q.value = 2.6;
    snowGain = audioCtx.createGain();
    snowGain.gain.value = 0.0;
    snowSrc.connect(snowFilter);
    snowFilter.connect(snowGain);
    snowGain.connect(ambientIndoorFilter);
    snowSrc.start();

    // 4. Race car engine dual-oscillator synth + nitro air rush
    engineOscA = audioCtx.createOscillator();
    engineOscA.type = "sawtooth";
    engineOscA.frequency.value = 58;
    engineOscB = audioCtx.createOscillator();
    engineOscB.type = "triangle";
    engineOscB.frequency.value = 116;
    engineFilter = audioCtx.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 340;
    engineGain = audioCtx.createGain();
    engineGain.gain.value = 0.0;
    engineOscA.connect(engineFilter);
    engineOscB.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(sfxBus);
    engineOscA.start();
    engineOscB.start();

    nitroSrc = audioCtx.createBufferSource();
    nitroSrc.buffer = sharedNoiseBuf;
    nitroSrc.loop = true;
    const nitroFilter = audioCtx.createBiquadFilter();
    nitroFilter.type = "bandpass";
    nitroFilter.frequency.value = 1100;
    nitroFilter.Q.value = 0.9;
    nitroGain = audioCtx.createGain();
    nitroGain.gain.value = 0.0;
    nitroSrc.connect(nitroFilter);
    nitroFilter.connect(nitroGain);
    nitroGain.connect(sfxBus);
    nitroSrc.start();

    // 5. Spatial Police Cruiser Siren
    sirenOsc = audioCtx.createOscillator();
    sirenOsc.type = "triangle";
    sirenOsc.frequency.value = 640;
    const sirenFilter = audioCtx.createBiquadFilter();
    sirenFilter.type = "lowpass";
    sirenFilter.frequency.value = 1400;
    sirenGain = audioCtx.createGain();
    sirenGain.gain.value = 0.0;
    sirenPan = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
    sirenOsc.connect(sirenFilter);
    sirenFilter.connect(sirenGain);
    if (sirenPan) {
      sirenGain.connect(sirenPan);
      sirenPan.connect(sfxBus);
    } else {
      sirenGain.connect(sfxBus);
    }
    sirenOsc.start();
  }

  function unlock() {
    if (typeof window === "undefined") return false;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;

    if (!ctx) {
      try {
        ctx = new Ctor();
        masterGain = ctx.createGain();
        masterGain.gain.value = enabled ? volume : 0;
        masterGain.connect(ctx.destination);

        ambientBus = ctx.createGain();
        ambientBus.gain.value = 0.85;
        ambientBus.connect(masterGain);

        ambientIndoorFilter = ctx.createBiquadFilter();
        ambientIndoorFilter.type = "lowpass";
        ambientIndoorFilter.frequency.value = 12000;
        ambientIndoorFilter.connect(ambientBus);

        sfxBus = ctx.createGain();
        sfxBus.gain.value = 0.9;
        sfxBus.connect(masterGain);

        voiceBus = ctx.createGain();
        voiceBus.gain.value = 1.05;
        voiceBus.connect(masterGain);

        initContinuousLoops(ctx);
      } catch {
        return false;
      }
    }

    if (ctx.state === "suspended") {
      ctx
        .resume()
        .then(() => {
          if (!unlocked && ctx?.state === "running") {
            unlocked = true;
            applyMasterGain();
            emit();
          }
        })
        .catch(() => {});
    } else if (ctx.state === "running" && !unlocked) {
      unlocked = true;
      applyMasterGain();
      emit();
    }
    return unlocked;
  }

  function isReady() {
    return Boolean(enabled && ctx && ctx.state === "running");
  }

  function makeSpatialChain(bus, pan = 0, gainVal = 1) {
    const outGain = ctx.createGain();
    outGain.gain.value = Math.max(0, Math.min(1.5, gainVal));
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      panner.connect(outGain);
      outGain.connect(bus);
      return { input: panner, gain: outGain, panner };
    }
    outGain.connect(bus);
    return { input: outGain, gain: outGain, panner: null };
  }

  function playTone(freq, dur = 0.14, type = "triangle", gainPeak = 0.08, delaySec = 0, pan = 0) {
    if (!isReady()) return;
    try {
      const t0 = ctx.currentTime + delaySec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(40, freq), t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainPeak), t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      const chain = makeSpatialChain(sfxBus, pan, 1);
      osc.connect(gain);
      gain.connect(chain.input);
      osc.start(t0);
      osc.stop(t0 + dur + 0.025);
    } catch {
      // Ignore oscillator edge timing errors
    }
  }

  function playNoiseBurst({ dur = 0.09, freq = 900, q = 1.0, filterType = "bandpass", gainPeak = 0.05, delaySec = 0, pan = 0 } = {}) {
    if (!isReady() || !sharedNoiseBuf) return;
    try {
      const t0 = ctx.currentTime + delaySec;
      const src = ctx.createBufferSource();
      src.buffer = sharedNoiseBuf;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(freq, t0);
      filter.Q.setValueAtTime(q, t0);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(Math.max(0.0005, gainPeak), t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      const chain = makeSpatialChain(sfxBus, pan, 1);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(chain.input);
      src.start(t0, Math.random() * 1.2, dur + 0.02);
    } catch {
      // Ignore
    }
  }

  // ---------------- Discrete World & Player SFX ----------------

  function playFootstep(surface = "grass", sprint = false) {
    if (!isReady()) return;
    const pitchJitter = 0.92 + Math.random() * 0.16;
    const gainMult = sprint ? 1.25 : 0.92;
    if (surface === "snow") {
      playNoiseBurst({ dur: 0.085, freq: 2400 * pitchJitter, q: 1.2, filterType: "highpass", gainPeak: 0.045 * gainMult });
      playTone(95 * pitchJitter, 0.055, "sine", 0.025 * gainMult);
    } else if (surface === "puddle") {
      playNoiseBurst({ dur: 0.1, freq: 1700 * pitchJitter, q: 1.5, filterType: "bandpass", gainPeak: 0.055 * gainMult });
      playTone(320 * pitchJitter, 0.06, "sine", 0.022 * gainMult);
    } else if (surface === "road" || surface === "wood") {
      playTone((surface === "wood" ? 130 : 165) * pitchJitter, 0.055, "triangle", 0.042 * gainMult);
      playNoiseBurst({ dur: 0.045, freq: 1100 * pitchJitter, q: 1.8, filterType: "bandpass", gainPeak: 0.026 * gainMult });
    } else if (surface === "sand") {
      playNoiseBurst({ dur: 0.075, freq: 1400 * pitchJitter, q: 0.9, filterType: "bandpass", gainPeak: 0.038 * gainMult });
    } else {
      // Soft meadow grass step
      playNoiseBurst({ dur: 0.068, freq: 980 * pitchJitter, q: 0.9, filterType: "bandpass", gainPeak: 0.032 * gainMult });
      playTone(105 * pitchJitter, 0.05, "sine", 0.024 * gainMult);
    }
  }

  function playJump(sprint = false) {
    if (!isReady()) return;
    const t0 = ctx.currentTime;
    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(160, t0);
      osc.frequency.exponentialRampToValueAtTime(sprint ? 390 : 320, t0 + 0.11);
      g.gain.setValueAtTime(0.055, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
      osc.connect(g);
      g.connect(sfxBus);
      osc.start(t0);
      osc.stop(t0 + 0.14);
    } catch {
      // Ignore
    }
  }

  function playLand(surface = "grass") {
    if (!isReady()) return;
    playTone(88, 0.09, "sine", 0.06);
    playNoiseBurst({ dur: 0.09, freq: surface === "puddle" ? 1500 : 620, q: 0.9, gainPeak: 0.04 });
  }

  function playEmoteVoice(kind = "wave", opts = {}) {
    if (!isReady()) return;
    const pan = Number.isFinite(opts.pan) ? Math.max(-1, Math.min(1, opts.pan)) : 0;
    const gainMult = Number.isFinite(opts.gain) ? Math.max(0.04, Math.min(1.2, opts.gain)) : 1;
    const pitchScale = VOICE_PITCH_MAP[opts.voice] || (0.94 + Math.random() * 0.14);
    if (gainMult <= 0.03) return;

    const now = ctx.currentTime;
    const chain = makeSpatialChain(voiceBus, pan, gainMult);

    const formantGlide = (fStart, fEnd, dur, delay = 0, peak = 0.095) => {
      try {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(fStart * pitchScale, now + delay);
        osc.frequency.exponentialRampToValueAtTime(fEnd * pitchScale, now + delay + dur);
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(1050 * pitchScale, now + delay);
        filter.Q.setValueAtTime(2.4, now + delay);
        g.gain.setValueAtTime(0.0001, now + delay);
        g.gain.exponentialRampToValueAtTime(peak, now + delay + 0.018);
        g.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
        osc.connect(filter);
        filter.connect(g);
        g.connect(chain.input);
        osc.start(now + delay);
        osc.stop(now + delay + dur + 0.03);
      } catch {
        // Ignore
      }
    };

    if (kind === "jump") {
      // Energetic "Hup!"
      formantGlide(250, 440, 0.14, 0, 0.09);
    } else if (kind === "cheer") {
      // Cheerful "Woo-hoo!"
      formantGlide(310, 470, 0.16, 0, 0.095);
      formantGlide(440, 620, 0.24, 0.15, 0.105);
    } else {
      // Friendly "Hey-ya!" wave greeting
      formantGlide(290, 390, 0.12, 0, 0.088);
      formantGlide(360, 430, 0.16, 0.11, 0.085);
    }
  }

  function playChatPing(opts = {}) {
    if (!isReady()) return;
    const pan = Number.isFinite(opts.pan) ? opts.pan : 0;
    const gain = Number.isFinite(opts.gain) ? opts.gain : 0.9;
    const base = (VOICE_PITCH_MAP[opts.voice] || 1.0) * 580;
    playTone(base, 0.08, "sine", 0.045 * gain, 0, pan);
    playTone(base * 1.25, 0.11, "sine", 0.04 * gain, 0.07, pan);
  }

  function playShopChime() {
    if (!isReady()) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      playTone(f, 0.15, "triangle", 0.06, idx * 0.055);
    });
  }

  function playCoinWish() {
    if (!isReady()) return;
    playNoiseBurst({ dur: 0.14, freq: 1450, q: 1.4, gainPeak: 0.045 });
    playTone(987.77, 0.14, "sine", 0.065, 0.04);
    playTone(1318.51, 0.24, "sine", 0.075, 0.12);
  }

  function playRaceCountdown(isGo = false) {
    if (!isReady()) return;
    playTone(isGo ? 880 : 440, isGo ? 0.28 : 0.14, "triangle", isGo ? 0.095 : 0.075);
  }

  function playRaceFinish(place = 1) {
    if (!isReady()) return;
    const notes = place === 1 ? [523.25, 659.25, 783.99, 1046.5] : [440, 554.37, 659.25];
    notes.forEach((f, i) => playTone(f, 0.22, "triangle", 0.075, i * 0.08));
  }

  function playHeistTick() {
    if (!isReady()) return;
    const now = performance.now();
    if (now - lastHeistSoundAt < 240) return;
    lastHeistSoundAt = now;
    playTone(980 + Math.random() * 240, 0.045, "square", 0.025);
  }

  function playHeistAlarm() {
    if (!isReady()) return;
    [740, 560, 740, 560].forEach((f, idx) => {
      playTone(f, 0.16, "sawtooth", 0.05, idx * 0.16);
    });
  }

  function playLootSuccess() {
    if (!isReady()) return;
    [587.33, 783.99, 987.77, 1174.66].forEach((f, idx) => {
      playTone(f, 0.18, "triangle", 0.07, idx * 0.06);
    });
  }

  function playPoliceStop() {
    if (!isReady()) return;
    playTone(720, 0.16, "triangle", 0.07, 0);
    playTone(540, 0.22, "triangle", 0.065, 0.16);
  }

  function playBasketballShot(made = false) {
    if (!isReady()) return;
    if (made) {
      playNoiseBurst({ dur: 0.16, freq: 2400, q: 1.5, gainPeak: 0.055, delaySec: 0.08 });
      playTone(659.25, 0.12, "triangle", 0.06, 0.16);
      playTone(880, 0.18, "triangle", 0.07, 0.23);
    } else {
      playTone(155, 0.1, "square", 0.045, 0.06);
      playTone(115, 0.12, "triangle", 0.04, 0.14);
    }
  }

  function playScooterHorn() {
    if (!isReady()) return;
    playTone(698.46, 0.085, "triangle", 0.08, 0);
    playTone(880, 0.12, "triangle", 0.085, 0.09);
  }

  function playGearShift(level = 1) {
    if (!isReady()) return;
    const baseFreq = 340 + Math.min(4, Math.max(1, Number(level) || 1)) * 75;
    playTone(baseFreq, 0.045, "square", 0.042, 0);
    playTone(baseFreq * 1.45, 0.065, "triangle", 0.038, 0.035);
    playNoiseBurst({ dur: 0.035, freq: 3400, q: 2.2, gainPeak: 0.032 });
  }

  function playGreetingPing() {
    if (!isReady()) return;
    playTone(523.25, 0.11, "sine", 0.055, 0);
    playTone(659.25, 0.13, "sine", 0.06, 0.065);
    playTone(783.99, 0.22, "sine", 0.068, 0.13);
  }

  // ---------------- Continuous Frame / Environment Mixer ----------------

  function updateWorldState(state) {
    if (!state || !ctx || !unlocked) return;
    const now = ctx.currentTime;
    const rainMix = Math.max(0, Math.min(1, Number(state.rainMix) || 0));
    const snowMix = Math.max(0, Math.min(1, Number(state.snowMix) || 0));
    const isInside = Boolean(state.isInside);

    if (ambientIndoorFilter) {
      ambientIndoorFilter.frequency.setTargetAtTime(isInside ? 760 : 12000, now, 0.12);
    }
    if (breezeGain) {
      const breezeTarget = isInside ? 0.022 : 0.055 + (1 - Math.max(rainMix, snowMix)) * 0.015;
      breezeGain.gain.setTargetAtTime(breezeTarget, now, 0.15);
    }
    if (rainGain) {
      rainGain.gain.setTargetAtTime(rainMix * (isInside ? 0.055 : 0.145), now, 0.18);
    }
    if (snowGain && snowFilter) {
      snowGain.gain.setTargetAtTime(snowMix * (isInside ? 0.032 : 0.095), now, 0.18);
      const howl = 430 + Math.sin(performance.now() * 0.0014) * 140;
      snowFilter.frequency.setTargetAtTime(howl, now, 0.15);
    }

    // Subtle procedural raindrops in outdoors rain
    if (isReady() && !isInside && rainMix > 0.35 && performance.now() >= nextRainDropAt) {
      nextRainDropAt = performance.now() + 90 + Math.random() * 240;
      playTone(1400 + Math.random() * 1400, 0.035, "sine", 0.012 * rainMix, 0, Math.random() * 1.4 - 0.7);
    }

    // Race Car or Delivery Scooter Engine + Nitro / Turbo
    const r = state.raceStatus;
    const d = state.deliveryRide;
    if (engineGain && engineOscA && engineOscB && engineFilter && nitroGain) {
      if (r?.active) {
        const speedNorm = Math.min(1, (Number(r.speedKmh) || 0) / 118);
        const rpmFreq = 54 + speedNorm * 118 + (r.nitroActive ? 26 : 0);
        engineOscA.frequency.setTargetAtTime(rpmFreq, now, 0.05);
        engineOscB.frequency.setTargetAtTime(rpmFreq * 1.98, now, 0.05);
        engineFilter.frequency.setTargetAtTime(280 + speedNorm * 950 + (r.nitroActive ? 450 : 0), now, 0.06);
        engineGain.gain.setTargetAtTime(0.036 + speedNorm * 0.042, now, 0.05);
        nitroGain.gain.setTargetAtTime(r.nitroActive ? 0.085 : 0.0, now, 0.05);
      } else if (d?.active) {
        const dSpeedNorm = Math.min(1, (Number(d.speedKmh) || 0) / 108);
        const dLvl = Math.max(1, Math.min(4, Number(d.speedLevel) || 1));
        const scooterRpm = 68 + dSpeedNorm * (95 + dLvl * 14);
        engineOscA.frequency.setTargetAtTime(scooterRpm, now, 0.05);
        engineOscB.frequency.setTargetAtTime(scooterRpm * 2.15, now, 0.05);
        engineFilter.frequency.setTargetAtTime(320 + dSpeedNorm * 780 + dLvl * 90, now, 0.06);
        engineGain.gain.setTargetAtTime(0.026 + dSpeedNorm * 0.038, now, 0.05);
        nitroGain.gain.setTargetAtTime(dLvl === 4 && dSpeedNorm > 0.65 ? 0.045 : 0.0, now, 0.05);
      } else {
        engineGain.gain.setTargetAtTime(0.0, now, 0.08);
        nitroGain.gain.setTargetAtTime(0.0, now, 0.08);
      }
    }

    // Spatial Police Siren during pursuit
    if (sirenGain && sirenOsc) {
      const wanted = Number(state.wantedStars) || 0;
      const cruiserDist = Number.isFinite(state.closestCruiserDist) ? state.closestCruiserDist : 999;
      if (wanted > 0 && cruiserDist < 76) {
        const distAtten = Math.max(0, 1 - cruiserDist / 76);
        const roomFactor = isInside ? 0.32 : 1.0;
        const targetGain = distAtten * distAtten * 0.052 * roomFactor;
        const sweep = Math.sin(performance.now() * 0.0085);
        sirenOsc.frequency.setTargetAtTime(640 + sweep * 195, now, 0.04);
        sirenGain.gain.setTargetAtTime(targetGain, now, 0.08);
        if (sirenPan) {
          sirenPan.pan.setTargetAtTime(Math.max(-1, Math.min(1, Number(state.closestCruiserPan) || 0)), now, 0.06);
        }
      } else {
        sirenGain.gain.setTargetAtTime(0.0, now, 0.12);
      }
    }
  }

  // ---------------- Remote Player Live Voice Playback (Clips & WebRTC) ----------------

  async function playRemoteVoiceClip({ audioBase64, mimeType, pan = 0, gain = 1.0 }) {
    if (!enabled || !audioBase64) return false;
    unlock();
    const safeGain = Math.max(0.04, Math.min(1.25, Number(gain) || 0));
    const safePan = Math.max(-1, Math.min(1, Number(pan) || 0));
    if (safeGain <= 0.02) return false;

    if (ctx && ctx.state === "running") {
      try {
        const bytes = decodeBase64ToUint8(audioBase64);
        const arrBuf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        const decoded = await ctx.decodeAudioData(arrBuf);
        const src = ctx.createBufferSource();
        src.buffer = decoded;
        const chain = makeSpatialChain(voiceBus, safePan, safeGain * 1.15);
        src.connect(chain.input);
        src.start();
        return true;
      } catch {
        // Fallback to HTMLAudioElement below if browser codec decoding prefers Audio tag
      }
    }

    try {
      const audio = new Audio(`data:${mimeType || "audio/webm"};base64,${audioBase64}`);
      audio.volume = Math.max(0, Math.min(1, volume * safeGain));
      await audio.play();
      return true;
    } catch {
      return false;
    }
  }

  function attachPeerMediaStream(peerId, mediaStream) {
    if (!peerId || !mediaStream) return false;
    unlock();
    if (!ctx) return false;
    detachPeerMediaStream(peerId);

    try {
      // Chromium requires an unmuted/paused hidden Audio element trick on some platforms for WebRTC MediaStreamAudioSourceNode
      const dummyAudio = new Audio();
      dummyAudio.srcObject = mediaStream;
      dummyAudio.muted = true;
      dummyAudio.play().catch(() => {});

      const src = ctx.createMediaStreamSource(mediaStream);
      const gainNode = ctx.createGain();
      gainNode.gain.value = 1.0;
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) {
        src.connect(panner);
        panner.connect(gainNode);
      } else {
        src.connect(gainNode);
      }
      gainNode.connect(voiceBus);

      peerStreams.set(peerId, { src, gainNode, panner, dummyAudio });
      return true;
    } catch {
      return false;
    }
  }

  function updatePeerSpatialMix(peerId, pan = 0, gainVal = 1.0) {
    const rec = peerStreams.get(peerId);
    if (!rec || !ctx) return;
    const now = ctx.currentTime;
    rec.gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1.25, gainVal)), now, 0.08);
    if (rec.panner) {
      rec.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, 0.08);
    }
  }

  function detachPeerMediaStream(peerId) {
    const rec = peerStreams.get(peerId);
    if (!rec) return;
    peerStreams.delete(peerId);
    try {
      rec.src.disconnect();
      rec.panner?.disconnect();
      rec.gainNode.disconnect();
      if (rec.dummyAudio) {
        rec.dummyAudio.srcObject = null;
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  function setEnabled(next) {
    enabled = Boolean(next);
    saveSoundEnabled(enabled);
    if (enabled) unlock();
    applyMasterGain();
    emit();
    return enabled;
  }

  function toggle() {
    return setEnabled(!enabled);
  }

  function setVolume(nextVol) {
    const clean = Math.max(0.05, Math.min(1, Number(nextVol) || 0.72));
    volume = clean;
    saveMasterVolume(clean);
    applyMasterGain();
    emit();
    return volume;
  }

  function dispose() {
    for (const peerId of Array.from(peerStreams.keys())) {
      detachPeerMediaStream(peerId);
    }
    try {
      breezeSrc?.stop();
      rainSrc?.stop();
      snowSrc?.stop();
      engineOscA?.stop();
      engineOscB?.stop();
      nitroSrc?.stop();
      sirenOsc?.stop();
      ctx?.close();
    } catch {
      // Ignore close errors
    }
    ctx = null;
  }

  return {
    unlock,
    getAudioGraph: () => (ctx && masterGain ? { ctx, masterGain, isUnlocked: unlocked } : null),
    setEnabled,
    toggle,
    setVolume,
    getState,
    updateWorldState,
    playFootstep,
    playJump,
    playLand,
    playEmoteVoice,
    playChatPing,
    playShopChime,
    playCoinWish,
    playRaceCountdown,
    playRaceFinish,
    playHeistTick,
    playHeistAlarm,
    playLootSuccess,
    playPoliceStop,
    playBasketballShot,
    playScooterHorn,
    playGearShift,
    playGreetingPing,
    playRemoteVoiceClip,
    attachPeerMediaStream,
    updatePeerSpatialMix,
    detachPeerMediaStream,
    dispose,
  };
}

// Dynamic 3D Weather System (Clear / Rain / Snow), Island Treasury Bank & Vault, and Patrolling Police Cruisers.

import * as THREE from "three";
import { Vox, buildVoxelMesh } from "./vox.js";

export const BANK_VAULT_POS = Object.freeze({
  id: "treasury-bank-vault",
  name: "Island Treasury Bank",
  x: 26,
  z: 22,
  yaw: -Math.PI * 0.25,
  radius: 4.0,
});

const PATROL_LOOP_INNER = [
  [-24, -20],
  [0, -20],
  [24, -20],
  [24, 0],
  [24, 20],
  [0, 20],
  [-24, 20],
  [-24, 0],
];

const PATROL_LOOP_OUTER = [
  [54, -28],
  [64, 18],
  [24, 52],
  [-32, 56],
  [-62, 18],
  [-56, -42],
  [4, -64],
  [46, -54],
];

const CLEAR_BG_HEX = 0xc5e6f8;
const RAIN_BG_HEX = 0x768fa6;
const SNOW_BG_HEX = 0xdbe7f2;

const CLEAR_SUN_COL = new THREE.Color(0xfff3db);
const RAIN_SUN_COL = new THREE.Color(0xc2d5ea);
const SNOW_SUN_COL = new THREE.Color(0xeaf2ff);

const CLEAR_HEMI_SKY = new THREE.Color(0xeef7ff);
const RAIN_HEMI_SKY = new THREE.Color(0x9eb4c8);
const SNOW_HEMI_SKY = new THREE.Color(0xdbe8f8);

const CLEAR_HEMI_GND = new THREE.Color(0x6ea44c);
const RAIN_HEMI_GND = new THREE.Color(0x46633f);
const SNOW_HEMI_GND = new THREE.Color(0xc2d4e4);

const CLEAR_FOG_COL = new THREE.Color(0xc2e3f6);
const RAIN_FOG_COL = new THREE.Color(0x7c93aa);
const SNOW_FOG_COL = new THREE.Color(0xdbe7f3);

const _tmpColA = new THREE.Color();
const _tmpColB = new THREE.Color();
const _dummyObj = new THREE.Object3D();

export function createWeatherController({
  scene,
  grassUniforms,
  skyDome,
  oceanMesh,
  sun,
  hemi,
  rim,
  ogMode = false,
  onWeatherChange = null,
}) {
  const weather = {
    mode: "clear", // "clear" | "rain" | "snow"
    autoMode: !ogMode,
    rainMix: 0,
    snowMix: 0,
    windX: 0.4,
    windZ: 0.2,
    nextEventSec: 38 + Math.random() * 28,
    eventRemainingSec: 0,
    speedMult: 1.0,
    carSpeedMult: 1.0,
  };

  // Pre-build 3D Instanced Rain Streaks & Voxel Snowflakes
  const RAIN_COUNT = 420;
  const SNOW_COUNT = 320;
  const BOX_RADIUS = 24;
  const BOX_HEIGHT = 20;

  const rainGeo = new THREE.BoxGeometry(0.036, 0.72, 0.036);
  const rainMat = new THREE.MeshBasicMaterial({
    color: 0xd0ecff,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
  });
  const rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, RAIN_COUNT);
  rainMesh.frustumCulled = false;
  rainMesh.castShadow = false;
  rainMesh.receiveShadow = false;
  rainMesh.raycast = () => {};
  rainMesh.visible = false;
  scene.add(rainMesh);

  const snowGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  const snowMat = new THREE.MeshBasicMaterial({
    color: 0xf7fbff,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });
  const snowMesh = new THREE.InstancedMesh(snowGeo, snowMat, SNOW_COUNT);
  snowMesh.frustumCulled = false;
  snowMesh.castShadow = false;
  snowMesh.receiveShadow = false;
  snowMesh.raycast = () => {};
  snowMesh.visible = false;
  scene.add(snowMesh);

  const rainSeeds = Array.from({ length: RAIN_COUNT }, (_, i) => ({
    ox: ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * BOX_RADIUS * 2 - BOX_RADIUS,
    oy: ((Math.sin(i * 78.233) * 19341.123) % 1 + 1) % 1 * BOX_HEIGHT,
    oz: ((Math.sin(i * 41.123) * 28173.451) % 1 + 1) % 1 * BOX_RADIUS * 2 - BOX_RADIUS,
    spd: 17 + (i % 7) * 1.6,
  }));

  const snowSeeds = Array.from({ length: SNOW_COUNT }, (_, i) => ({
    ox: ((Math.sin(i * 29.41) * 31987.21) % 1 + 1) % 1 * BOX_RADIUS * 2 - BOX_RADIUS,
    oy: ((Math.sin(i * 93.77) * 14921.88) % 1 + 1) % 1 * BOX_HEIGHT,
    oz: ((Math.sin(i * 53.19) * 22415.67) % 1 + 1) % 1 * BOX_RADIUS * 2 - BOX_RADIUS,
    spd: 2.3 + (i % 5) * 0.42,
    phase: i * 0.71,
    scale: 0.72 + (i % 4) * 0.22,
  }));

  const weatherFog = new THREE.FogExp2(CLEAR_FOG_COL.getHex(), 0.0001);
  if (!ogMode) {
    scene.fog = weatherFog;
  }

  function wrapCoord(v, span) {
    const half = span * 0.5;
    let r = ((v + half) % span + span) % span;
    return r - half;
  }

  function notifyChange(source = "auto") {
    onWeatherChange?.({
      ...getState(),
      source,
    });
  }

  function setMode(nextMode, opts = {}) {
    const clean = nextMode === "rain" || nextMode === "snow" ? nextMode : "clear";
    const changed = weather.mode !== clean;
    weather.mode = clean;
    if (typeof opts.autoMode === "boolean") {
      weather.autoMode = opts.autoMode;
    }
    if (clean === "clear") {
      weather.eventRemainingSec = 0;
      weather.nextEventSec = 42 + Math.random() * 32;
      weather.windX = 0.3;
    } else if (clean === "rain") {
      weather.eventRemainingSec = opts.durationSec || 34 + Math.random() * 18;
      weather.windX = 1.6;
      weather.windZ = 0.7;
    } else if (clean === "snow") {
      weather.eventRemainingSec = opts.durationSec || 36 + Math.random() * 20;
      weather.windX = (Math.random() > 0.5 ? 1 : -1) * (1.8 + Math.random() * 1.2);
      weather.windZ = 0.6;
    }
    if (changed || opts.forceNotify) {
      notifyChange(opts.source || "manual");
    }
    return getState();
  }

  function setAutoMode(enabled) {
    weather.autoMode = Boolean(enabled) && !ogMode;
    notifyChange("auto_toggle");
    return getState();
  }

  function triggerRandomEvent(preferredMode = null) {
    if (ogMode) return getState();
    const pick =
      preferredMode === "rain" || preferredMode === "snow"
        ? preferredMode
        : weather.mode === "rain"
          ? "snow"
          : weather.mode === "snow"
            ? "rain"
            : Math.random() < 0.55
              ? "rain"
              : "snow";
    return setMode(pick, { source: "random_event" });
  }

  function getState() {
    const slowPct = Math.round((1 - weather.speedMult) * 100);
    const carSlowPct = Math.round((1 - weather.carSpeedMult) * 100);
    return {
      mode: weather.mode,
      autoMode: weather.autoMode,
      rainMix: weather.rainMix,
      snowMix: weather.snowMix,
      windX: weather.windX,
      windZ: weather.windZ,
      speedMult: weather.speedMult,
      carSpeedMult: weather.carSpeedMult,
      slowPct,
      carSlowPct,
      eventRemainingSec: Math.max(0, Math.ceil(weather.eventRemainingSec)),
      nextEventSec: Math.max(0, Math.ceil(weather.nextEventSec)),
    };
  }

  function step(dt, t, focusX = 0, focusY = 0, focusZ = 0, isInside = false, isPerspCam = false) {
    if (ogMode) {
      grassUniforms.uWeather?.value?.set(0, 0);
      rainMesh.visible = false;
      snowMesh.visible = false;
      return;
    }

    const clampedDt = Math.min(0.1, Math.max(0.001, dt));

    // Random weather scheduler when Auto Weather is enabled
    if (weather.autoMode) {
      if (weather.mode === "clear") {
        weather.nextEventSec -= clampedDt;
        if (weather.nextEventSec <= 0) {
          const next = Math.random() < 0.56 ? "rain" : "snow";
          setMode(next, { source: "random_event" });
        }
      } else {
        weather.eventRemainingSec -= clampedDt;
        if (weather.eventRemainingSec <= 0) {
          setMode("clear", { source: "random_clear" });
        }
      }
    }

    const targetRain = weather.mode === "rain" ? 1 : 0;
    const targetSnow = weather.mode === "snow" ? 1 : 0;
    const blendAlpha = 1 - Math.exp(-clampedDt * 1.45);
    weather.rainMix += (targetRain - weather.rainMix) * blendAlpha;
    weather.snowMix += (targetSnow - weather.snowMix) * blendAlpha;
    if (Math.abs(weather.rainMix) < 0.004 && targetRain === 0) weather.rainMix = 0;
    if (Math.abs(weather.snowMix) < 0.004 && targetSnow === 0) weather.snowMix = 0;

    // Movement multipliers: rain slows walking 22% & cars 14%; snow slows walking 34% & cars 22%
    weather.speedMult = 1.0 - weather.rainMix * 0.22 - weather.snowMix * 0.34;
    weather.carSpeedMult = 1.0 - weather.rainMix * 0.14 - weather.snowMix * 0.22;

    if (grassUniforms?.uWeather?.value) {
      grassUniforms.uWeather.value.set(weather.rainMix, weather.snowMix);
    }
    if (skyDome?.material?.uniforms?.uWeather?.value) {
      skyDome.material.uniforms.uWeather.value.set(weather.rainMix, weather.snowMix);
    }
    if (oceanMesh?.material?.uniforms?.uWeather?.value) {
      oceanMesh.material.uniforms.uWeather.value.set(weather.rainMix, weather.snowMix);
    }

    // Update Rain InstancedMesh
    const showRain = !isInside && weather.rainMix > 0.04;
    rainMesh.visible = showRain;
    if (showRain) {
      rainMat.opacity = 0.54 * weather.rainMix;
      const slantZ = 0.12;
      for (let i = 0; i < RAIN_COUNT; i++) {
        const s = rainSeeds[i];
        const px = focusX + wrapCoord(s.ox + t * weather.windX * 1.5 - focusX, BOX_RADIUS * 2);
        const pz = focusZ + wrapCoord(s.oz + t * weather.windZ * 1.5 - focusZ, BOX_RADIUS * 2);
        const py = Math.max(0.2, focusY - 1.5 + (((s.oy - t * s.spd) % BOX_HEIGHT + BOX_HEIGHT) % BOX_HEIGHT));
        _dummyObj.position.set(px, py, pz);
        _dummyObj.rotation.set(slantZ, 0, -0.09);
        _dummyObj.scale.set(1, 0.75 + weather.rainMix * 0.45, 1);
        _dummyObj.updateMatrix();
        rainMesh.setMatrixAt(i, _dummyObj.matrix);
      }
      rainMesh.instanceMatrix.needsUpdate = true;
    }

    // Update Snow InstancedMesh
    const showSnow = !isInside && weather.snowMix > 0.04;
    snowMesh.visible = showSnow;
    if (showSnow) {
      snowMat.opacity = 0.86 * weather.snowMix;
      for (let i = 0; i < SNOW_COUNT; i++) {
        const s = snowSeeds[i];
        const driftX = Math.sin(t * 1.3 + s.phase) * 0.9 + t * weather.windX * 0.55;
        const driftZ = Math.cos(t * 1.1 + s.phase) * 0.9 + t * weather.windZ * 0.45;
        const px = focusX + wrapCoord(s.ox + driftX - focusX, BOX_RADIUS * 2);
        const pz = focusZ + wrapCoord(s.oz + driftZ - focusZ, BOX_RADIUS * 2);
        const py = Math.max(0.15, focusY - 1.0 + (((s.oy - t * s.spd) % BOX_HEIGHT + BOX_HEIGHT) % BOX_HEIGHT));
        _dummyObj.position.set(px, py, pz);
        _dummyObj.rotation.set(t * 0.9 + s.phase, t * 1.2, 0);
        _dummyObj.scale.setScalar(s.scale * (0.65 + weather.snowMix * 0.45));
        _dummyObj.updateMatrix();
        snowMesh.setMatrixAt(i, _dummyObj.matrix);
      }
      snowMesh.instanceMatrix.needsUpdate = true;
    }

    applyLighting(isInside, isPerspCam);
  }

  function applyLighting(isInside = false, isPerspCam = false) {
    if (ogMode) return;
    const r = weather.rainMix;
    const sn = weather.snowMix;
    if (isInside) {
      sun.intensity = 0.28;
      sun.color.copy(CLEAR_SUN_COL);
      hemi.intensity = 0.68;
      hemi.color.copy(CLEAR_HEMI_SKY);
      hemi.groundColor.copy(CLEAR_HEMI_GND);
      rim.intensity = 0.22;
      if (scene.fog) scene.fog.density = 0;
      return;
    }

    const sunBase = 2.25 * (1.0 - r * 0.42 - sn * 0.24);
    const hemiBase = 1.12 * (1.0 - r * 0.14 + sn * 0.12);
    sun.intensity = sunBase;
    hemi.intensity = hemiBase;
    rim.intensity = 0.35 * (1.0 - r * 0.35 + sn * 0.22);

    _tmpColA.copy(CLEAR_SUN_COL).lerp(RAIN_SUN_COL, r).lerp(SNOW_SUN_COL, sn);
    sun.color.copy(_tmpColA);

    _tmpColA.copy(CLEAR_HEMI_SKY).lerp(RAIN_HEMI_SKY, r).lerp(SNOW_HEMI_SKY, sn);
    hemi.color.copy(_tmpColA);

    _tmpColB.copy(CLEAR_HEMI_GND).lerp(RAIN_HEMI_GND, r).lerp(SNOW_HEMI_GND, sn);
    hemi.groundColor.copy(_tmpColB);

    if (scene.fog) {
      _tmpColA.copy(CLEAR_FOG_COL).lerp(RAIN_FOG_COL, r).lerp(SNOW_FOG_COL, sn);
      scene.fog.color.copy(_tmpColA);
      const baseDensity = isPerspCam ? 0.0007 : 0.0001;
      scene.fog.density = baseDensity + r * (isPerspCam ? 0.0058 : 0.0014) + sn * (isPerspCam ? 0.0068 : 0.0016);
    }

    if (scene.background && scene.background.isColor) {
      scene.background.setHex(CLEAR_BG_HEX).lerp(RAIN_FOG_COL, r).lerp(new THREE.Color(SNOW_BG_HEX), sn);
    }
  }

  function dispose() {
    scene.remove(rainMesh);
    scene.remove(snowMesh);
    rainGeo.dispose();
    rainMat.dispose();
    snowGeo.dispose();
    snowMat.dispose();
  }

  return {
    setMode,
    setAutoMode,
    triggerRandomEvent,
    getState,
    getPlayerSpeedMultiplier: () => (ogMode ? 1.0 : weather.speedMult),
    getCarSpeedMultiplier: () => (ogMode ? 1.0 : weather.carSpeedMult),
    getWindX: () => (ogMode ? 0 : weather.windX * Math.max(weather.snowMix, weather.rainMix * 0.35)),
    step,
    applyLighting,
    dispose,
  };
}

function buildTreasuryBankGroup() {
  const root = new THREE.Group();
  const v = new Vox(940);
  // Stepped marble plinth
  v.box(-10, 0, -8, 10, 1, 9, "#dcd7cc");
  v.box(-9, 1, -7, 9, 2, 8, "#ebe6dc");
  // Main stone vault building
  v.box(-8, 2, -7, 8, 13, 5, "#ece7dd");
  // Dark interior vestibule behind vault gate
  v.box(-3, 2, 4, 3, 9, 5, "#242830");
  // Classical columns along facade
  for (const cx of [-7, -4, 4, 7]) {
    v.box(cx, 2, 5, cx + 1, 12, 6, "#f7f3ea");
  }
  // Cornice & stepped dome/pediment
  v.box(-9, 12, -8, 9, 14, 7, "#276e47");
  v.box(-7, 14, -6, 7, 16, 4, "#f4eee2");
  v.box(-5, 16, -4, 5, 18, 2, "#d8ac38", 0.35);
  // Glowing gold Treasury emblem & vault ring on front
  v.ringAxis("z", 0, 6, 5, 6, 3.2, 1.9, "#f5c43c", 0.9);
  v.box(-1, 5, 5, 1, 7, 6, "#ffe488", 1.2);
  // Security beacon crystal on top
  v.box(-1, 18, -2, 1, 20, 0, "#4ce8e0", 1.4);
  // Velvet rope bollards out front
  v.box(-4, 2, 7, -3, 5, 8, "#d4a43b");
  v.box(3, 2, 7, 4, 5, 8, "#d4a43b");
  v.box(-3, 4, 7, 3, 4, 8, "#d93b3b");

  const mesh = buildVoxelMesh(v, { scale: 0.24, castShadow: true, receiveShadow: true });
  root.add(mesh);

  // Invisible interactive hit volume for clicking Bank in Pan/Orbit
  const hitGeo = new THREE.BoxGeometry(4.8, 4.8, 4.4);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.position.set(0, 2.4, 0.2);
  hitMesh.userData.bankVaultId = BANK_VAULT_POS.id;
  root.add(hitMesh);

  root.userData.dispose = () => {
    mesh.geometry?.dispose?.();
    mesh.material?.dispose?.();
    hitGeo.dispose();
    hitMat.dispose();
  };
  return root;
}

function buildPoliceCruiserRig(unitName = "Unit 04") {
  const root = new THREE.Group();
  const s = 0.205;

  const v = new Vox(unitName === "Unit 07" ? 962 : 961);
  // Midnight navy hood, trunk & bumpers
  v.box(-4, 1, -9, 4, 4, 9, "#1c2b4a");
  // Crisp white patrol doors & cabin roof
  v.box(-4, 2, -3, 4, 4, 3, "#f7f9fc");
  v.box(-3, 4, -4, 3, 6, 2, "#f7f9fc");
  // Dark tinted windows
  v.box(-2, 4, 2, 2, 5.5, 3, "#7cc2e8");
  v.box(-2, 4, -5, 2, 5.5, -4, "#7cc2e8");
  // Yellow star badge on side doors
  v.put(-4, 3, 0, "#f5c43c", 0.5);
  v.put(4, 3, 0, "#f5c43c", 0.5);
  // Headlights & taillights
  v.box(-3, 2, 9, -2, 3, 9, "#fff4c2", 1.4);
  v.box(2, 2, 9, 3, 3, 9, "#fff4c2", 1.4);
  v.box(-3, 2, -9, -2, 3, -9, "#ff4a3d", 1.2);
  v.box(2, 2, -9, 3, 3, -9, "#ff4a3d", 1.2);
  // Push-bar bullbar
  v.box(-3, 1, 9, 3, 3, 10, "#242830");

  const bodyMesh = buildVoxelMesh(v, { scale: s, castShadow: true, receiveShadow: true });
  bodyMesh.position.y = 0.14;
  root.add(bodyMesh);

  // Separate Red & Blue emergency lightbar beacons so they alternate flash dynamically
  const barGeo = new THREE.BoxGeometry(0.46, 0.2, 0.34);
  const redMat = new THREE.MeshStandardMaterial({
    color: 0xff2b2b,
    emissive: 0xff2b2b,
    emissiveIntensity: 1.6,
    roughness: 0.25,
  });
  const blueMat = new THREE.MeshStandardMaterial({
    color: 0x2b7bff,
    emissive: 0x2b7bff,
    emissiveIntensity: 0.2,
    roughness: 0.25,
  });
  const redBeacon = new THREE.Mesh(barGeo, redMat);
  redBeacon.position.set(-0.26, 1.54, -0.2);
  const blueBeacon = new THREE.Mesh(barGeo, blueMat);
  blueBeacon.position.set(0.26, 1.54, -0.2);
  root.add(redBeacon);
  root.add(blueBeacon);

  // 4 black voxel wheels
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e2026, roughness: 0.85 });
  const wheels = [];
  for (const [wx, wz] of [[-0.92, 1.22], [0.92, 1.22], [-0.92, -1.22], [0.92, -1.22]]) {
    const wm = new THREE.Mesh(wheelGeo, wheelMat);
    wm.position.set(wx, 0.32, wz);
    wm.castShadow = true;
    root.add(wm);
    wheels.push(wm);
  }

  // Click hitbox
  const hitGeo = new THREE.BoxGeometry(2.2, 1.8, 4.2);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.position.set(0, 0.9, 0);
  hitMesh.userData.policeUnitId = unitName;
  root.add(hitMesh);

  root.userData.dispose = () => {
    bodyMesh.geometry?.dispose?.();
    bodyMesh.material?.dispose?.();
    barGeo.dispose();
    redMat.dispose();
    blueMat.dispose();
    wheelGeo.dispose();
    wheelMat.dispose();
    hitGeo.dispose();
    hitMat.dispose();
  };

  return {
    root,
    redMat,
    blueMat,
    wheels,
    hitMesh,
  };
}

export function createPoliceAndHeistSystem({
  scene,
  getGroundHeight,
  ogMode = false,
  onPoliceStopTrigger = null,
  onHeistStateChange = null,
}) {
  const root = new THREE.Group();
  root.visible = !ogMode;
  scene.add(root);

  // 1. Place Island Treasury Bank at clear plaza spot (26, 22)
  const bankGroup = buildTreasuryBankGroup();
  bankGroup.position.set(BANK_VAULT_POS.x, getGroundHeight(BANK_VAULT_POS.x, BANK_VAULT_POS.z), BANK_VAULT_POS.z);
  bankGroup.rotation.y = BANK_VAULT_POS.yaw;
  root.add(bankGroup);

  // 2. Spawn 2 Patrolling Police Cruisers
  const cruisers = [
    {
      id: "Unit 04",
      officer: "Officer Sunny",
      loop: PATROL_LOOP_INNER,
      wpIdx: 0,
      x: -24,
      z: -20,
      yaw: 0,
      baseSpeed: 6.4,
      pursuitSpeed: 9.2,
      rig: buildPoliceCruiserRig("Unit 04"),
    },
    {
      id: "Unit 07",
      officer: "Officer Cruz",
      loop: PATROL_LOOP_OUTER,
      wpIdx: 3,
      x: -32,
      z: 56,
      yaw: 1.2,
      baseSpeed: 8.6,
      pursuitSpeed: 10.6,
      rig: buildPoliceCruiserRig("Unit 07"),
    },
  ];
  for (const c of cruisers) {
    c.rig.root.position.set(c.x, getGroundHeight(c.x, c.z), c.z);
    c.rig.root.rotation.y = c.yaw;
    root.add(c.rig.root);
  }

  const heistState = {
    wantedStars: 0, // 0..3
    hotLoot: 0, // Unstashed cash risk if caught
    stashTimerSec: 0, // Evade police for 22s to stash cleanly
    fleeGraceSec: 0, // Grace after fleeing a stop
    stopActive: false,
    activeRobbery: null, // { id, name, kind, rewardMin, rewardMax, durationSec, remainingSec, totalSec }
    robCooldownByTarget: new Map(), // targetId -> epoch ms
    stopCooldownUntilMs: 0,
    heistsCompleted: 0,
    stopsSurvived: 0,
    lastReportSec: -1,
  };

  function emitState(extra = {}) {
    onHeistStateChange?.({
      ...getState(),
      ...extra,
    });
  }

  function getState() {
    return {
      wantedStars: heistState.wantedStars,
      hotLoot: heistState.hotLoot,
      stashTimerSec: Math.max(0, Math.ceil(heistState.stashTimerSec)),
      fleeGraceSec: Math.max(0, Math.ceil(heistState.fleeGraceSec)),
      stopActive: heistState.stopActive,
      activeRobbery: heistState.activeRobbery
        ? {
            ...heistState.activeRobbery,
            progress01: Math.max(
              0,
              Math.min(
                1,
                1 - heistState.activeRobbery.remainingSec / Math.max(0.1, heistState.activeRobbery.totalSec),
              ),
            ),
          }
        : null,
      heistsCompleted: heistState.heistsCompleted,
      stopsSurvived: heistState.stopsSurvived,
    };
  }

  function getTargetCooldownRemainingSec(targetId) {
    const until = heistState.robCooldownByTarget.get(targetId) || 0;
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  }

  function startRobbery(target) {
    if (ogMode || !target) return { ok: false, reason: "Unavailable" };
    if (heistState.stopActive) return { ok: false, reason: "Resolve the Police Stop first!" };
    if (heistState.activeRobbery) return { ok: false, reason: "Already cracking a safe!" };
    const remCd = getTargetCooldownRemainingSec(target.id);
    if (remCd > 0) {
      return { ok: false, reason: `${target.name} alarm reset — wait ${remCd}s` };
    }

    const isBank = target.kind === "bank";
    const dur = isBank ? 4.2 : 3.2;
    heistState.activeRobbery = {
      id: target.id,
      name: target.name,
      kind: isBank ? "bank" : "store",
      x: Number(target.x) || BANK_VAULT_POS.x,
      z: Number(target.z) || BANK_VAULT_POS.z,
      rewardMin: isBank ? 95 : 45,
      rewardMax: isBank ? 140 : 75,
      totalSec: dur,
      remainingSec: dur,
    };
    emitState({ event: "robbery_started", targetName: target.name });
    return { ok: true, robbery: heistState.activeRobbery };
  }

  function cancelRobbery(reason = "Cancelled") {
    if (!heistState.activeRobbery) return false;
    const prev = heistState.activeRobbery;
    heistState.activeRobbery = null;
    emitState({ event: "robbery_cancelled", targetName: prev.name, reason });
    return true;
  }

  function triggerManualStop(cruiserInfo = null, reason = "Patrol Check") {
    if (ogMode || heistState.stopActive) return false;
    const unit = cruiserInfo || cruisers[0];
    heistState.stopActive = true;
    heistState.activeRobbery = null;
    const stopPayload = {
      unitId: unit.id,
      officer: unit.officer,
      wantedStars: heistState.wantedStars,
      hotLoot: heistState.hotLoot,
      fineCredits: heistState.wantedStars > 0 ? heistState.wantedStars * 35 + Math.round(heistState.hotLoot * 0.45) : 15,
      reason,
    };
    emitState({ event: "police_stop_started" });
    onPoliceStopTrigger?.(stopPayload);
    return true;
  }

  function resolvePoliceStop(action, ctx = {}) {
    heistState.stopActive = false;
    heistState.stopCooldownUntilMs = Date.now() + 9500;
    const weatherMode = ctx.weatherMode || "clear";
    const hasMission = Boolean(ctx.hasActiveMission);
    const fineCredits = heistState.wantedStars > 0 ? heistState.wantedStars * 35 + Math.round(heistState.hotLoot * 0.45) : 15;

    if (action === "comply") {
      const confiscated = heistState.hotLoot;
      heistState.wantedStars = 0;
      heistState.hotLoot = 0;
      heistState.stashTimerSec = 0;
      emitState({ event: "stop_complied" });
      return {
        outcome: "complied",
        finePaid: fineCredits,
        confiscated,
        message:
          fineCredits > 0
            ? `Paid ${fineCredits} cr fine & cleared Wanted status.`
            : "Routine patrol check cleared — have a safe drive!",
      };
    }

    if (action === "bluff") {
      // Bad weather or courier disguise helps your bluff!
      const bonus = (weatherMode !== "clear" ? 0.22 : 0) + (hasMission ? 0.24 : 0);
      const baseChance = heistState.wantedStars === 0 ? 0.85 : heistState.wantedStars === 1 ? 0.55 : 0.35;
      const success = Math.random() < Math.min(0.92, baseChance + bonus);
      if (success) {
        const savedLoot = heistState.hotLoot;
        heistState.wantedStars = 0;
        heistState.hotLoot = 0;
        heistState.stashTimerSec = 0;
        heistState.stopsSurvived += 1;
        emitState({ event: "stop_bluffed_ok" });
        return {
          outcome: "bluff_success",
          finePaid: 0,
          keptLoot: savedLoot,
          message: hasMission
            ? "Officer Sunny accepted your courier alibi and waved you through!"
            : "Your weather visibility excuse worked — Officer Sunny let you off with a warning!",
        };
      }
      heistState.wantedStars = Math.min(3, Math.max(1, heistState.wantedStars + 1));
      heistState.fleeGraceSec = 7.5;
      heistState.stashTimerSec = 22;
      emitState({ event: "stop_bluffed_fail" });
      return {
        outcome: "bluff_failed",
        finePaid: 0,
        wantedStars: heistState.wantedStars,
        message: "Officer Sunny saw through the bluff — Wanted level raised! Evade patrol for 22s!",
      };
    }

    // "flee"
    heistState.wantedStars = Math.min(3, Math.max(1, heistState.wantedStars));
    heistState.fleeGraceSec = 8.5;
    heistState.stashTimerSec = 22;
    emitState({ event: "stop_fled" });
    return {
      outcome: "fled",
      wantedStars: heistState.wantedStars,
      message: "You hit the gas and bolted from the stop! Shake both cruisers for 22s!",
    };
  }

  function step(dt, t, playerX, playerZ, opts = {}) {
    if (ogMode) return;
    const clampedDt = Math.min(0.08, Math.max(0.001, dt));
    const carMult = opts.carSpeedMult ?? 1.0;
    const weatherMode = opts.weatherMode || "clear";
    const isInside = Boolean(opts.isInside);
    const playerInRangeCheck = !isInside && !opts.isRacing;

    // 1. Step active Robbery cracking countdown
    if (heistState.activeRobbery) {
      const rb = heistState.activeRobbery;
      const dist = Math.hypot(playerX - rb.x, playerZ - rb.z);
      if (dist > 11.5) {
        cancelRobbery("Moved too far away");
      } else {
        rb.remainingSec -= clampedDt;
        if (rb.remainingSec <= 0) {
          const loot =
            rb.rewardMin + Math.floor(Math.random() * Math.max(1, rb.rewardMax - rb.rewardMin + 1));
          const isBank = rb.kind === "bank";
          heistState.robCooldownByTarget.set(rb.id, Date.now() + (isBank ? 45_000 : 32_000));
          heistState.activeRobbery = null;
          heistState.hotLoot += loot;
          heistState.wantedStars = Math.min(3, heistState.wantedStars + (isBank ? 2 : 1));
          heistState.stashTimerSec = 22;
          heistState.fleeGraceSec = 2.5;
          heistState.heistsCompleted += 1;
          emitState({
            event: "robbery_completed",
            loot,
            targetName: rb.name,
            wantedStars: heistState.wantedStars,
          });
        }
      }
    }

    // 2. Step Escape / Stash countdown
    if (heistState.fleeGraceSec > 0) {
      heistState.fleeGraceSec = Math.max(0, heistState.fleeGraceSec - clampedDt);
    }
    if (heistState.wantedStars > 0 && !heistState.stopActive) {
      heistState.stashTimerSec -= clampedDt;
      if (heistState.stashTimerSec <= 0) {
        const bonus = 20 + heistState.wantedStars * 5;
        heistState.wantedStars = 0;
        heistState.hotLoot = 0;
        heistState.stashTimerSec = 0;
        heistState.stopsSurvived += 1;
        emitState({
          event: "loot_stashed",
          escapeBonus: bonus,
        });
      }
    }

    // 3. Step 2 Police Cruisers (Patrol OR Pursuit)
    const pursuit = heistState.wantedStars > 0 && !heistState.stopActive;
    const visibilityMult = weatherMode === "clear" ? 1.0 : 0.75; // rain/snow reduces police catch/sight radius by 25%
    const catchDist = 6.2 * visibilityMult;
    const sirenPhase = Math.sin(t * (pursuit ? 18 : 7)) > 0;

    for (let i = 0; i < cruisers.length; i++) {
      const c = cruisers[i];
      c.rig.redMat.emissiveIntensity = sirenPhase ? 2.2 : 0.15;
      c.rig.blueMat.emissiveIntensity = sirenPhase ? 0.15 : 2.2;

      const distToPlayer = Math.hypot(playerX - c.x, playerZ - c.z);
      const shouldChase = pursuit && !isInside && distToPlayer < 85 * visibilityMult && !heistState.stopActive;

      let targetX;
      let targetZ;
      if (shouldChase && distToPlayer > 3.5) {
        targetX = playerX;
        targetZ = playerZ;
      } else {
        const wp = c.loop[c.wpIdx];
        targetX = wp[0];
        targetZ = wp[1];
        if (Math.hypot(targetX - c.x, targetZ - c.z) < 3.4) {
          c.wpIdx = (c.wpIdx + 1) % c.loop.length;
        }
      }

      const dx = targetX - c.x;
      const dz = targetZ - c.z;
      const d = Math.hypot(dx, dz) || 1;
      const desiredYaw = Math.atan2(dx, dz);
      let dyaw = desiredYaw - c.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      c.yaw += dyaw * Math.min(1, clampedDt * (shouldChase ? 4.2 : 3.2));

      const spd = (shouldChase ? c.pursuitSpeed : c.baseSpeed) * carMult;
      const stepDist = heistState.stopActive && distToPlayer < 12 ? 0 : spd * clampedDt;
      c.x += Math.sin(c.yaw) * stepDist;
      c.z += Math.cos(c.yaw) * stepDist;

      // Avoid driving onto Bank plinth
      const bdx = c.x - BANK_VAULT_POS.x;
      const bdz = c.z - BANK_VAULT_POS.z;
      const bd = Math.hypot(bdx, bdz);
      if (bd < 4.8 && bd > 0.01) {
        c.x = BANK_VAULT_POS.x + (bdx / bd) * 4.8;
        c.z = BANK_VAULT_POS.z + (bdz / bd) * 4.8;
      }

      const gy = getGroundHeight(c.x, c.z);
      c.rig.root.position.set(c.x, gy, c.z);
      c.rig.root.rotation.y = c.yaw;
      for (const w of c.rig.wheels) {
        w.rotation.x += stepDist / 0.32;
      }

      // Check Police Intercept!
      if (
        pursuit &&
        playerInRangeCheck &&
        heistState.fleeGraceSec <= 0 &&
        Date.now() >= heistState.stopCooldownUntilMs &&
        distToPlayer <= catchDist
      ) {
        triggerManualStop(
          c,
          heistState.wantedStars >= 2
            ? "Treasury Heist Alert — Pull Over!"
            : "Store Robbery Dispatch — Hands Up!",
        );
      }
    }

    // Periodic UI timer tick while robbing or escaping
    const curSec = Math.floor(t * 5);
    if ((heistState.activeRobbery || heistState.wantedStars > 0) && curSec !== heistState.lastReportSec) {
      heistState.lastReportSec = curSec;
      emitState();
    }
  }

  function findNearbyInteractable(px, pz) {
    if (ogMode) return null;
    for (const c of cruisers) {
      if (Math.hypot(c.x - px, c.z - pz) <= 5.2) {
        return {
          kind: "police_cruiser",
          id: c.id,
          cruiser: c,
          label:
            heistState.wantedStars > 0
              ? `Surrender to ${c.id}`
              : `Patrol Check (${c.officer})`,
        };
      }
    }
    if (Math.hypot(BANK_VAULT_POS.x - px, BANK_VAULT_POS.z - pz) <= 6.2) {
      const cd = getTargetCooldownRemainingSec(BANK_VAULT_POS.id);
      return {
        kind: "bank_vault",
        id: BANK_VAULT_POS.id,
        name: BANK_VAULT_POS.name,
        x: BANK_VAULT_POS.x,
        z: BANK_VAULT_POS.z,
        cooldownSec: cd,
        label: cd > 0 ? `Bank Vault Alarm (${cd}s)` : "Rob Bank Vault (+95-140 cr)",
      };
    }
    return null;
  }

  function getInteractiveObjects() {
    return [bankGroup, ...cruisers.map((c) => c.rig.root)];
  }

  function getMapOverlayState() {
    return {
      bank: { ...BANK_VAULT_POS },
      cruisers: cruisers.map((c) => ({
        id: c.id,
        officer: c.officer,
        x: c.x,
        z: c.z,
        pursuit: heistState.wantedStars > 0,
      })),
    };
  }

  function dispose() {
    scene.remove(root);
    bankGroup.userData.dispose?.();
    for (const c of cruisers) {
      c.rig.root.userData.dispose?.();
    }
  }

  return {
    getState,
    startRobbery,
    cancelRobbery,
    triggerManualStop,
    resolvePoliceStop,
    findNearbyInteractable,
    getInteractiveObjects,
    getMapOverlayState,
    step,
    dispose,
  };
}

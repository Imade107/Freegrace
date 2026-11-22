// 3D Island Grand Prix Car Racing Circuit, District Signpost Totems, Drivable Voxel Race Cars, and AI Rivals.

import * as THREE from "three";
import { ISLAND_CITIES, RACE_PADDOCK_POS, getCarSpec } from "../world_catalog.js";
import { Vox, buildVoxelMesh } from "./vox.js";

// Matches OUTER_RING_ROAD_POINTS loop counter-clockwise/clockwise starting cleanly at Suncoast East Paddock
export const RACE_TRACK_WAYPOINTS = [
  [79, 0],
  [76, 34],
  [62, 60],
  [26, 56],
  [-8, 66],
  [-34, 74],
  [-68, 42],
  [-85, 18],
  [-81, -6],
  [-78, -44],
  [-58, -60],
  [-32, -82],
  [0, -86],
  [36, -80],
  [58, -58],
  [78, -36],
];

const CHECKPOINT_COUNT = 8;
const BOOST_FRACTIONS = [0.16, 0.42, 0.67, 0.89];
const ISLAND_HALF_EXTENT = 163.5;
const ISLAND_SUPERELLIPSE_EXP = 3.1;

function getIslandInlandMargin(x, z) {
  const ax = Math.abs(x) / ISLAND_HALF_EXTENT;
  const az = Math.abs(z) / ISLAND_HALF_EXTENT;
  const superDist =
    Math.pow(
      Math.pow(ax, ISLAND_SUPERELLIPSE_EXP) + Math.pow(az, ISLAND_SUPERELLIPSE_EXP),
      1 / ISLAND_SUPERELLIPSE_EXP,
    ) * ISLAND_HALF_EXTENT;
  const theta = Math.atan2(z, x);
  const warp =
    9.2 * Math.cos(2 * theta + 1.55) +
    7.8 * Math.sin(3 * theta + 0.75) +
    5.6 * Math.cos(4 * theta + 3.08) +
    4.1 * Math.sin(5 * theta - 0.85) +
    2.6 * Math.cos(7 * theta + 0.4);
  return ISLAND_HALF_EXTENT + warp - superDist;
}

function buildClosedTrackSamples(sampleCount = 260) {
  const pts3 = RACE_TRACK_WAYPOINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts3, true, "catmullrom", 0.45);
  const rawLen = curve.getLength();
  const samples = [];
  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  for (let i = 0; i < sampleCount; i++) {
    const u = i / sampleCount;
    curve.getPointAt(u, p);
    curve.getTangentAt(u, tan);
    tan.y = 0;
    if (tan.lengthSq() > 1e-6) tan.normalize();
    samples.push({
      u,
      s: u * rawLen,
      x: p.x,
      z: p.z,
      tx: tan.x,
      tz: tan.z,
      yaw: Math.atan2(tan.x, tan.z),
    });
  }
  return { curve, totalLen: rawLen, samples };
}

function buildRaceCarRig(carSpec, driverTag = "player") {
  const root = new THREE.Group();
  const s = 0.21;
  const primary = carSpec.primaryColor || "#df5246";
  const accent = carSpec.accentColor || "#f6c944";
  const isBuggy = carSpec.id === "buggy";
  const isApex = carSpec.id === "apex";

  // 1. Painted Body Shell (Voxel mesh)
  const bodyVox = new Vox(carSpec.id === "buggy" ? 311 : carSpec.id === "apex" ? 322 : 303);
  // Lower chassis tray (matte dark)
  bodyVox.box(-4, 1, -9, 4, 2, 9, "#23262e");
  // Main painted fuselage
  bodyVox.box(-4, 2, -9, 4, 4, 8, primary);
  // Hood taper & racing stripe
  bodyVox.box(-3, 4, 2, 3, 5, 8, primary);
  bodyVox.box(-1, 4.1, -8, 1, 5.1, 8.2, accent);
  // Cockpit cabin / windshield frame
  if (isBuggy) {
    bodyVox.box(-3, 5, -4, 3, 7, 2, "#23262e");
    bodyVox.box(-3, 7, -5, 3, 8, 1, accent);
    bodyVox.box(-2, 4, -9, 2, 7, -7, "#1e2024"); // spare tire mount look
  } else if (isApex) {
    bodyVox.box(-3, 4, -4, 3, 6.5, 2, primary);
    bodyVox.box(-4, 6, -9, 4, 7, -7, "#1a1d24"); // wide GT wing
    bodyVox.box(-3, 4, -9, -2, 6, -7, primary);
    bodyVox.box(2, 4, -9, 3, 6, -7, primary);
  } else {
    bodyVox.box(-3, 4, -4, 3, 6, 2, primary);
    bodyVox.box(-4, 5.2, -8, 4, 5.8, -7, accent);
  }
  const bodyMesh = buildVoxelMesh(bodyVox, { scale: s, castShadow: true, receiveShadow: true });
  bodyMesh.position.y = 0.04;
  root.add(bodyMesh);

  // 2. Glazed Windshield & Canopy (Physical clear material for contrast)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: "#bfe9ff",
    roughness: 0.14,
    metalness: 0.08,
    transmission: 0.42,
    transparent: true,
    opacity: 0.84,
  });
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(5.2 * s, 2.2 * s, 4.2 * s),
    glassMat,
  );
  glass.position.set(0, 5.6 * s, -0.5 * s);
  root.add(glass);

  // 3. Emissive Headlights & Brake/Tail lights
  const headMat = new THREE.MeshStandardMaterial({
    color: "#fff4cc",
    emissive: "#ffe494",
    emissiveIntensity: 1.4,
    roughness: 0.25,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: "#ff4438",
    emissive: "#df2820",
    emissiveIntensity: 1.35,
    roughness: 0.28,
  });
  const headGeo = new THREE.BoxGeometry(1.5 * s, 0.9 * s, 0.4 * s);
  const hl = new THREE.Mesh(headGeo, headMat);
  hl.position.set(2.5 * s, 3.2 * s, 8.9 * s);
  const hr = new THREE.Mesh(headGeo, headMat);
  hr.position.set(-2.5 * s, 3.2 * s, 8.9 * s);

  const tl = new THREE.Mesh(headGeo, tailMat);
  tl.position.set(2.5 * s, 3.4 * s, -9.1 * s);
  const tr = new THREE.Mesh(headGeo, tailMat);
  tr.position.set(-2.5 * s, 3.4 * s, -9.1 * s);
  root.add(hl, hr, tl, tr);

  // 4. 4 Grounded Wheels (bottom rests cleanly on y = 0)
  const wheelR = isBuggy ? 0.44 : 0.39;
  const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.36, 14);
  wheelGeo.rotateZ(Math.PI * 0.5);
  const tireMat = new THREE.MeshStandardMaterial({ color: "#1c1f26", roughness: 0.85, metalness: 0.05 });
  const rimGeo = new THREE.CylinderGeometry(wheelR * 0.52, wheelR * 0.52, 0.39, 10);
  rimGeo.rotateZ(Math.PI * 0.5);
  const rimMat = new THREE.MeshStandardMaterial({
    color: driverTag === "player" ? accent : "#e2e6ed",
    roughness: 0.3,
    metalness: 0.7,
  });

  const makeWheel = (wx, wz) => {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(wx, wheelR, wz);
    const spinPivot = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    spinPivot.add(tire, rim);
    steerPivot.add(spinPivot);
    root.add(steerPivot);
    return { steerPivot, spinPivot };
  };

  const trackHalfX = 4.25 * s;
  const frontZ = 5.4 * s;
  const rearZ = -5.6 * s;
  const wheels = {
    fl: makeWheel(trackHalfX, frontZ),
    fr: makeWheel(-trackHalfX, frontZ),
    rl: makeWheel(trackHalfX, rearZ),
    rr: makeWheel(-trackHalfX, rearZ),
    wheelR,
  };

  root.userData.raceCarId = carSpec.id;
  root.userData.dispose = () => {
    root.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach((m) => m?.dispose?.());
        else o.material?.dispose?.();
      }
    });
  };

  return { root, bodyMesh, wheels };
}

function buildDistrictSignpostGroup(city) {
  const group = new THREE.Group();
  const vox = new Vox(city.centerX * 7 + city.centerZ * 13);
  // Stone plinth at ground
  vox.box(-2, 0, -2, 2, 1, 2, "#8e949c");
  // Timber pillar
  vox.box(-0.5, 1, -0.5, 0.5, 12, 0.5, "woodDark");
  // Directional district signboard
  vox.box(-4, 8, -0.8, 5, 11, 0.8, city.accent || "#3a7d44");
  vox.box(-3, 8.6, 0.9, 4, 10.4, 1.1, "#fcfaf5");
  // Lantern topper
  vox.box(-1, 12, -1, 1, 14, 1, "warmGlow", 1.2);
  const mesh = buildVoxelMesh(vox, { scale: 0.24, castShadow: true, receiveShadow: true });
  group.add(mesh);

  // Subtle brass collar ring for visual hierarchy
  const capMat = new THREE.MeshStandardMaterial({
    color: city.accent || "#3a7d44",
    roughness: 0.3,
    metalness: 0.55,
  });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.14, 12), capMat);
  collar.position.y = 0.28;
  group.add(collar);

  group.position.set(city.signX, 0, city.signZ);
  // Face inward toward district plaza center
  group.rotation.y = Math.atan2(city.centerX - city.signX, city.centerZ - city.signZ);
  group.userData.districtSignId = city.id;
  group.userData.districtName = city.name;
  group.userData.pickRadius = 1.65;
  return group;
}

function buildStartFinishPaddockGroup(startSample) {
  const group = new THREE.Group();
  const gantry = new THREE.Group();

  const pillarGeo = new THREE.BoxGeometry(0.9, 5.2, 0.9);
  const pillarMat = new THREE.MeshStandardMaterial({ color: "#df5246", roughness: 0.45, metalness: 0.15 });
  const baseGeo = new THREE.BoxGeometry(1.4, 0.6, 1.4);
  const baseMat = new THREE.MeshStandardMaterial({ color: "#68707a", roughness: 0.85 });

  for (const side of [-4.9, 4.9]) {
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(side, 2.6, 0);
    p.castShadow = true;
    const b = new THREE.Mesh(baseGeo, baseMat);
    b.position.set(side, 0.3, 0);
    b.receiveShadow = true;
    gantry.add(p, b);
  }

  // Top checkered banner spanning the road cleanly above cars/buses
  const beamGeo = new THREE.BoxGeometry(10.8, 1.25, 1.0);
  const beamMat = new THREE.MeshStandardMaterial({ color: "#1d222b", roughness: 0.55 });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(0, 5.4, 0);
  beam.castShadow = true;
  gantry.add(beam);

  const sqGeo = new THREE.BoxGeometry(1.0, 0.55, 1.06);
  const whiteMat = new THREE.MeshStandardMaterial({ color: "#fafaf7", roughness: 0.5 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: "#f5b82e",
    emissive: "#d99218",
    emissiveIntensity: 0.45,
    roughness: 0.3,
  });
  for (let i = -4; i <= 4; i++) {
    const sq = new THREE.Mesh(sqGeo, i % 2 === 0 ? whiteMat : goldMat);
    sq.position.set(i * 1.12, 5.4, 0);
    gantry.add(sq);
  }

  // Pitside starter booth on inside left of road
  const booth = new THREE.Group();
  const boothVox = new Vox(777);
  boothVox.box(-3, 0, -2, 3, 1, 2, "concrete");
  boothVox.box(-2, 1, -2, 2, 7, 1, "#fcfaf5");
  boothVox.box(-3, 7, -3, 3, 9, 2, "#df5246");
  boothVox.box(-1, 3, 1, 1, 5, 2, "#f5b82e");
  const boothMesh = buildVoxelMesh(boothVox, { scale: 0.24, castShadow: true, receiveShadow: true });
  booth.add(boothMesh);
  booth.position.set(-6.8, 0, 0);
  gantry.add(booth);

  gantry.position.set(startSample.x, 0, startSample.z);
  gantry.rotation.y = startSample.yaw;
  gantry.userData.racePaddock = true;
  gantry.userData.pickRadius = 3.2;

  group.add(gantry);
  return { root: group, gantry };
}

function buildCheckpointGates(trackSamples, totalLen) {
  const gates = [];
  const postGeo = new THREE.CylinderGeometry(0.18, 0.22, 3.6, 10);
  const haloGeo = new THREE.TorusGeometry(4.4, 0.14, 8, 28, Math.PI);

  for (let i = 0; i < CHECKPOINT_COUNT; i++) {
    const u = (i + 1) / (CHECKPOINT_COUNT + 0.5);
    const idx = Math.floor(u * trackSamples.length) % trackSamples.length;
    const smp = trackSamples[idx];
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: "#3ec8b0",
      emissive: "#1a8e7a",
      emissiveIntensity: 0.35,
      roughness: 0.35,
      transparent: true,
      opacity: 0.85,
    });
    const lp = new THREE.Mesh(postGeo, mat);
    lp.position.set(-4.4, 1.8, 0);
    const rp = new THREE.Mesh(postGeo, mat);
    rp.position.set(4.4, 1.8, 0);
    const arch = new THREE.Mesh(haloGeo, mat);
    arch.position.set(0, 3.3, 0);
    g.add(lp, rp, arch);
    g.position.set(smp.x, 0, smp.z);
    g.rotation.y = smp.yaw;
    g.visible = false;
    gates.push({
      index: i,
      s: u * totalLen,
      x: smp.x,
      z: smp.z,
      group: g,
      mat,
    });
  }
  return gates;
}

function buildBoostPads(trackSamples, totalLen) {
  const pads = [];
  const padGeo = new THREE.PlaneGeometry(3.6, 4.8);
  padGeo.rotateX(-Math.PI * 0.5);
  for (let i = 0; i < BOOST_FRACTIONS.length; i++) {
    const u = BOOST_FRACTIONS[i];
    const idx = Math.floor(u * trackSamples.length) % trackSamples.length;
    const smp = trackSamples[idx];
    const mat = new THREE.MeshStandardMaterial({
      color: "#22d3ee",
      emissive: "#0ea5e9",
      emissiveIntensity: 0.9,
      roughness: 0.25,
      transparent: true,
      opacity: 0.85,
    });
    const mesh = new THREE.Mesh(padGeo, mat);
    mesh.position.set(smp.x, 0.045, smp.z);
    mesh.rotation.y = smp.yaw;
    mesh.visible = false;
    pads.push({
      s: u * totalLen,
      x: smp.x,
      z: smp.z,
      mesh,
      cooldownUntil: 0,
    });
  }
  return pads;
}

export function createRaceAndCitySystem(scene) {
  const track = buildClosedTrackSamples(280);
  const startSample = track.samples[0];

  const root = new THREE.Group();
  scene.add(root);

  // 1. Always-present Paddock Gate & 6 District Signposts
  const paddock = buildStartFinishPaddockGroup(startSample);
  root.add(paddock.root);

  const districtSigns = [];
  for (const city of ISLAND_CITIES) {
    const signGroup = buildDistrictSignpostGroup(city);
    root.add(signGroup);
    districtSigns.push({
      city,
      group: signGroup,
      x: city.signX,
      z: city.signZ,
    });
  }

  // 2. Race Gates, Boost Pads & Active Race Cars Container
  const gates = buildCheckpointGates(track.samples, track.totalLen);
  for (const g of gates) root.add(g.group);

  const boostPads = buildBoostPads(track.samples, track.totalLen);
  for (const pad of boostPads) root.add(pad.mesh);

  const raceCarsGroup = new THREE.Group();
  root.add(raceCarsGroup);

  // Shared lightweight exhaust puff pool (zero allocations during driving loop)
  const puffs = [];
  const puffGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
  const puffMat = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(puffGeo, puffMat);
    m.visible = false;
    raceCarsGroup.add(m);
    puffs.push({ mesh: m, life: 0, vx: 0, vy: 0, vz: 0 });
  }
  let puffCursor = 0;
  let puffTimer = 0;

  function spawnExhaust(x, y, z, yaw, isNitro) {
    const p = puffs[puffCursor % puffs.length];
    puffCursor += 1;
    p.life = isNitro ? 0.42 : 0.32;
    p.mesh.position.set(
      x - Math.sin(yaw) * 1.9 + (Math.random() - 0.5) * 0.25,
      y + 0.38,
      z - Math.cos(yaw) * 1.9 + (Math.random() - 0.5) * 0.25,
    );
    p.vx = -Math.sin(yaw) * 2.2 + (Math.random() - 0.5) * 0.8;
    p.vy = 0.75 + Math.random() * 0.5;
    p.vz = -Math.cos(yaw) * 2.2 + (Math.random() - 0.5) * 0.8;
    p.mesh.scale.setScalar(isNitro ? 1.45 : 0.9);
    p.mesh.visible = true;
  }

  const raceState = {
    active: false,
    finished: false,
    totalLaps: 2,
    countdownSec: 0,
    startedAtMs: 0,
    lapStartMs: 0,
    bestLapMs: null,
    totalMs: 0,
    currentLap: 1,
    nextCheckpointIdx: 0,
    checkpointsHitThisLap: 0,
    lastTrackIdx: 0,
    trackS: 0,
    lateralOffset: 0,
    onRoad: true,
    place: 1,
    carSpec: getCarSpec("roadster"),
    upgrades: { topSpeedLevel: 0, nitroLevel: 0, gripLevel: 0 },
    playerRig: null,
    px: startSample.x,
    pz: startSample.z,
    pyaw: startSample.yaw,
    speed: 0, // m/s
    speedLevel: 4, // 1: Pit, 2: Warmup, 3: Sport, 4: Hyper
    steerVisual: 0,
    wheelSpin: 0,
    nitro: 100, // 0..100
    nitroActive: false,
    padBoostUntil: 0,
    cameraMode: "chase", // "chase" | "hood"
    rivals: [],
    finishNotified: false,
    onFinish: null,
    inputs: {
      forward: false,
      backward: false,
      left: false,
      right: false,
      nitro: false,
      touchSteer: 0,
    },
  };

  function nearestTrackSample(x, z, hintIdx = -1) {
    const samples = track.samples;
    const n = samples.length;
    let bestIdx = 0;
    let bestDistSq = Infinity;

    if (hintIdx >= 0 && hintIdx < n) {
      for (let off = -18; off <= 18; off++) {
        const i = (hintIdx + off + n) % n;
        const s = samples[i];
        const dSq = (x - s.x) * (x - s.x) + (z - s.z) * (z - s.z);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestIdx = i;
        }
      }
      if (bestDistSq < 180) {
        return { idx: bestIdx, sample: samples[bestIdx], dist: Math.sqrt(bestDistSq) };
      }
    }

    for (let i = 0; i < n; i++) {
      const s = samples[i];
      const dSq = (x - s.x) * (x - s.x) + (z - s.z) * (z - s.z);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }
    return { idx: bestIdx, sample: samples[bestIdx], dist: Math.sqrt(bestDistSq) };
  }

  function clearRaceMeshes() {
    if (raceState.playerRig) {
      raceCarsGroup.remove(raceState.playerRig.root);
      raceState.playerRig.root.userData.dispose?.();
      raceState.playerRig = null;
    }
    for (const r of raceState.rivals) {
      raceCarsGroup.remove(r.rig.root);
      r.rig.root.userData.dispose?.();
    }
    raceState.rivals = [];
    for (const p of puffs) p.mesh.visible = false;
    for (const g of gates) g.group.visible = false;
    for (const pad of boostPads) pad.mesh.visible = false;
  }

  function startRace({ carId = "roadster", upgrades = {}, laps = 2, onFinish = null } = {}) {
    clearRaceMeshes();

    raceState.carSpec = getCarSpec(carId);
    raceState.upgrades = {
      topSpeedLevel: Number(upgrades.topSpeedLevel) || 0,
      nitroLevel: Number(upgrades.nitroLevel) || 0,
      gripLevel: Number(upgrades.gripLevel) || 0,
    };
    raceState.totalLaps = Math.max(1, Math.min(3, laps));
    raceState.onFinish = onFinish;
    raceState.active = true;
    raceState.finished = false;
    raceState.finishNotified = false;
    raceState.countdownSec = 1.6;
    raceState.startedAtMs = performance.now() + 1600;
    raceState.lapStartMs = raceState.startedAtMs;
    raceState.bestLapMs = null;
    raceState.totalMs = 0;
    raceState.currentLap = 1;
    raceState.nextCheckpointIdx = 0;
    raceState.checkpointsHitThisLap = 0;
    raceState.lastTrackIdx = 0;
    raceState.trackS = 0;
    raceState.speed = 0;
    raceState.nitro = 100;
    raceState.padBoostUntil = 0;
    raceState.place = 4;

    // Grid start slightly behind Start/Finish arch
    const backIdx = track.samples.length - 3;
    const gridSmp = track.samples[backIdx];
    const rightX = -gridSmp.tz;
    const rightZ = gridSmp.tx;

    raceState.px = gridSmp.x + rightX * 1.4;
    raceState.pz = gridSmp.z + rightZ * 1.4;
    raceState.pyaw = gridSmp.yaw;
    raceState.lastTrackIdx = backIdx;
    raceState.trackS = 0;

    raceState.playerRig = buildRaceCarRig(raceState.carSpec, "player");
    raceState.playerRig.root.position.set(raceState.px, 0, raceState.pz);
    raceState.playerRig.root.rotation.y = raceState.pyaw;
    raceCarsGroup.add(raceState.playerRig.root);

    // 3 AI Rivals staggered on the starting grid
    const rivalDefs = [
      { name: "Sunny AI", id: "buggy", baseSpeed: 23.2, lane: -1.45, color: "#4c82d4", accent: "#fcfaf5" },
      { name: "Turbo Coco", id: "roadster", baseSpeed: 24.4, lane: 1.45, color: "#f5b82e", accent: "#23262e" },
      { name: "Apex Leo", id: "apex", baseSpeed: 26.2, lane: -1.5, color: "#9c4cc4", accent: "#f6d55c" },
    ];
    rivalDefs.forEach((def, idx) => {
      const sOffset = (track.totalLen - 7 - idx * 4.5) % track.totalLen;
      const spec = { ...getCarSpec(def.id), primaryColor: def.color, accentColor: def.accent };
      const rig = buildRaceCarRig(spec, `rival-${idx}`);
      const smp = track.samples[Math.floor((sOffset / track.totalLen) * track.samples.length) % track.samples.length];
      rig.root.position.set(smp.x - smp.tz * def.lane, 0, smp.z + smp.tx * def.lane);
      rig.root.rotation.y = smp.yaw;
      raceCarsGroup.add(rig.root);
      raceState.rivals.push({
        name: def.name,
        rig,
        baseSpeed: def.baseSpeed,
        lane: def.lane,
        s: sOffset,
        totalProgress: -(7 + idx * 4.5),
        lap: 1,
        wheelSpin: 0,
      });
    });

    for (const g of gates) g.group.visible = true;
    for (const pad of boostPads) {
      pad.mesh.visible = true;
      pad.cooldownUntil = 0;
    }
    updateGateColors();

    return getStatus();
  }

  function updateGateColors() {
    for (const g of gates) {
      if (g.index === raceState.nextCheckpointIdx) {
        g.mat.color.setHex(0xf5b82e);
        g.mat.emissive.setHex(0xd97706);
        g.mat.emissiveIntensity = 0.85;
        g.mat.opacity = 0.95;
      } else if (g.index < raceState.checkpointsHitThisLap) {
        g.mat.color.setHex(0x4ade80);
        g.mat.emissive.setHex(0x16a34a);
        g.mat.emissiveIntensity = 0.3;
        g.mat.opacity = 0.45;
      } else {
        g.mat.color.setHex(0x38bdf8);
        g.mat.emissive.setHex(0x0284c7);
        g.mat.emissiveIntensity = 0.35;
        g.mat.opacity = 0.65;
      }
    }
  }

  function stopRace() {
    raceState.active = false;
    raceState.finished = false;
    raceState.inputs.forward = false;
    raceState.inputs.backward = false;
    raceState.inputs.left = false;
    raceState.inputs.right = false;
    raceState.inputs.nitro = false;
    raceState.inputs.touchSteer = 0;
    clearRaceMeshes();
  }

  function respawnToTrack() {
    if (!raceState.active || !raceState.playerRig) return;
    const nearest = nearestTrackSample(raceState.px, raceState.pz, raceState.lastTrackIdx);
    raceState.px = nearest.sample.x;
    raceState.pz = nearest.sample.z;
    raceState.pyaw = nearest.sample.yaw;
    raceState.speed = 6;
    raceState.lastTrackIdx = nearest.idx;
  }

  function toggleCameraMode() {
    raceState.cameraMode = raceState.cameraMode === "chase" ? "hood" : "chase";
    return raceState.cameraMode;
  }

  function setInputs(patch) {
    Object.assign(raceState.inputs, patch);
  }

  function step(dt, obstacles = [], ponds = [], stepOpts = {}) {
    // Subtle lantern pulse on district signposts
    const nowSec = performance.now() * 0.001;
    void nowSec;

    if (!raceState.active || !raceState.playerRig) return;
    const clampedDt = Math.min(0.05, Math.max(0.001, dt));
    const nowMs = performance.now();
    const weatherMult = Number.isFinite(stepOpts?.weatherSpeedMult)
      ? Math.max(0.45, Math.min(1.1, stepOpts.weatherSpeedMult))
      : 1.0;

    if (raceState.countdownSec > 0) {
      raceState.countdownSec = Math.max(0, raceState.countdownSec - clampedDt);
    }
    const canDrive = raceState.countdownSec <= 0;

    // 1. Player Vehicle Arcade Physics
    const upSpeedBonus = raceState.upgrades.topSpeedLevel * 2.2;
    const upNitroMult = 1 + raceState.upgrades.nitroLevel * 0.14;
    const baseMaxFwd = raceState.carSpec.topSpeedKmh / 3.6 + upSpeedBonus; // ~26..35 m/s
    const accelRate = raceState.carSpec.accel || 25;

    const wantFwd = canDrive && raceState.inputs.forward;
    const wantRev = canDrive && raceState.inputs.backward;
    const usingNitro =
      canDrive &&
      !raceState.finished &&
      raceState.inputs.nitro &&
      raceState.nitro > 4 &&
      raceState.speed > 4;

    raceState.nitroActive = usingNitro;
    if (usingNitro) {
      raceState.nitro = Math.max(0, raceState.nitro - 28 * clampedDt);
    } else {
      const regen = raceState.onRoad ? 9.5 * upNitroMult : 5.5;
      raceState.nitro = Math.min(100, raceState.nitro + regen * clampedDt);
    }

    const levelScale = [0.42, 0.65, 0.86, 1.0];
    const levelMult = levelScale[(raceState.speedLevel || 4) - 1] || 1.0;
    const boostMult =
      (usingNitro ? (raceState.carSpec.nitroPower || 1.38) * upNitroMult : 1.0) *
      (nowMs < raceState.padBoostUntil ? 1.25 : 1.0);
    const surfaceMult = raceState.onRoad ? 1.0 : raceState.carSpec.grassPenalty || 0.78;
    const effectiveMaxFwd = baseMaxFwd * boostMult * surfaceMult * weatherMult * levelMult;

    if (wantFwd) {
      raceState.speed += accelRate * boostMult * weatherMult * levelMult * clampedDt;
    } else if (wantRev) {
      if (raceState.speed > 1.5) {
        raceState.speed -= accelRate * 1.85 * clampedDt;
      } else {
        raceState.speed -= accelRate * 0.65 * clampedDt;
      }
    } else {
      // Natural rolling drag
      const drag = Math.exp(-(raceState.onRoad ? 1.65 : 2.65) * clampedDt);
      raceState.speed *= drag;
      if (Math.abs(raceState.speed) < 0.08) raceState.speed = 0;
    }

    raceState.speed = Math.max(-11, Math.min(effectiveMaxFwd, raceState.speed));

    let steerDir = 0;
    if (canDrive) {
      if (raceState.inputs.left) steerDir += 1;
      if (raceState.inputs.right) steerDir -= 1;
      if (Math.abs(raceState.inputs.touchSteer) > 0.05) {
        steerDir -= raceState.inputs.touchSteer;
      }
    }
    steerDir = Math.max(-1, Math.min(1, steerDir));
    raceState.steerVisual += (steerDir - raceState.steerVisual) * Math.min(1, clampedDt * 12);

    const speedFactor = Math.min(1, Math.abs(raceState.speed) / 6.5);
    const turnRate = (raceState.carSpec.handling || 2.9) * (0.45 + 0.55 * speedFactor);
    const revSign = raceState.speed >= -0.2 ? 1 : -1;
    if (Math.abs(raceState.speed) > 0.3) {
      raceState.pyaw += steerDir * revSign * turnRate * clampedDt;
    }

    const fwdX = Math.sin(raceState.pyaw);
    const fwdZ = Math.cos(raceState.pyaw);
    raceState.px += fwdX * raceState.speed * clampedDt;
    raceState.pz += fwdZ * raceState.speed * clampedDt;

    // Elastic collision vs buildings, trees/obstacles, ponds & island shore
    const carRadius = 1.65;
    for (const obs of obstacles) {
      const dx = raceState.px - obs.x;
      const dz = raceState.pz - obs.z;
      const minD = (obs.r || 2) + carRadius;
      const d = Math.hypot(dx, dz);
      if (d < minD && d > 0.001) {
        const nx = dx / d;
        const nz = dz / d;
        raceState.px = obs.x + nx * minD;
        raceState.pz = obs.z + nz * minD;
        raceState.speed *= 0.65;
      }
    }
    for (const pond of ponds) {
      const dx = raceState.px - pond.x;
      const dz = raceState.pz - pond.z;
      const minD = (pond.radius || 6.4) + 1.8;
      const d = Math.hypot(dx, dz);
      if (d < minD && d > 0.001) {
        raceState.px = pond.x + (dx / d) * minD;
        raceState.pz = pond.z + (dz / d) * minD;
        raceState.speed *= 0.72;
      }
    }
    if (getIslandInlandMargin(raceState.px, raceState.pz) < 3.2) {
      const ang = Math.atan2(raceState.pz, raceState.px);
      const r = Math.hypot(raceState.px, raceState.pz);
      if (r > 1) {
        raceState.px = Math.cos(ang) * (r - 1.2);
        raceState.pz = Math.sin(ang) * (r - 1.2);
        raceState.speed *= 0.7;
      }
    }

    // Track projection & road grip check
    const nearest = nearestTrackSample(raceState.px, raceState.pz, raceState.lastTrackIdx);
    const prevS = raceState.trackS;
    raceState.lastTrackIdx = nearest.idx;
    raceState.trackS = nearest.sample.s;
    raceState.lateralOffset = nearest.dist;
    raceState.onRoad = nearest.dist <= 5.2;

    // Checkpoint & Boost Pad Checks
    if (!raceState.finished && canDrive) {
      const targetGate = gates[raceState.nextCheckpointIdx];
      if (targetGate && Math.hypot(raceState.px - targetGate.x, raceState.pz - targetGate.z) < 7.8) {
        raceState.checkpointsHitThisLap += 1;
        raceState.nextCheckpointIdx = (raceState.nextCheckpointIdx + 1) % CHECKPOINT_COUNT;
        updateGateColors();
      }

      // Check boost pads
      for (const pad of boostPads) {
        if (nowMs >= pad.cooldownUntil && Math.hypot(raceState.px - pad.x, raceState.pz - pad.z) < 4.5) {
          pad.cooldownUntil = nowMs + 2500;
          raceState.padBoostUntil = nowMs + 1650;
          raceState.nitro = Math.min(100, raceState.nitro + 26);
          raceState.speed = Math.max(raceState.speed, baseMaxFwd * 1.18);
        }
      }

      // Lap completion crossing Start/Finish arch after clearing >= 6 checkpoints
      const crossedWrap =
        prevS > track.totalLen * 0.78 && raceState.trackS < track.totalLen * 0.22;
      const nearStart =
        Math.hypot(raceState.px - startSample.x, raceState.pz - startSample.z) < 9.5;
      if ((crossedWrap || nearStart) && raceState.checkpointsHitThisLap >= CHECKPOINT_COUNT - 1) {
        const lapMs = Math.max(1000, nowMs - raceState.lapStartMs);
        if (raceState.bestLapMs === null || lapMs < raceState.bestLapMs) {
          raceState.bestLapMs = Math.round(lapMs);
        }
        raceState.lapStartMs = nowMs;
        raceState.checkpointsHitThisLap = 0;
        raceState.nextCheckpointIdx = 0;
        updateGateColors();

        if (raceState.currentLap >= raceState.totalLaps) {
          raceState.finished = true;
          raceState.totalMs = Math.round(nowMs - raceState.startedAtMs);
          if (!raceState.finishNotified) {
            raceState.finishNotified = true;
            raceState.onFinish?.({
              bestLapMs: raceState.bestLapMs,
              totalMs: raceState.totalMs,
              place: raceState.place,
              laps: raceState.totalLaps,
              carName: raceState.carSpec.name,
            });
          }
        } else {
          raceState.currentLap += 1;
        }
      }
    }

    // Apply player rig transform, steering, wheel rotation & suspension bob
    const rig = raceState.playerRig;
    const bounce = raceState.onRoad ? 0 : Math.sin(nowMs * 0.032) * 0.04;
    rig.root.position.set(raceState.px, bounce, raceState.pz);
    rig.root.rotation.y = raceState.pyaw;

    raceState.wheelSpin += (raceState.speed * clampedDt) / rig.wheels.wheelR;
    const steerAng = raceState.steerVisual * 0.42;
    rig.wheels.fl.steerPivot.rotation.y = steerAng;
    rig.wheels.fr.steerPivot.rotation.y = steerAng;
    rig.wheels.fl.spinPivot.rotation.x = raceState.wheelSpin;
    rig.wheels.fr.spinPivot.rotation.x = raceState.wheelSpin;
    rig.wheels.rl.spinPivot.rotation.x = raceState.wheelSpin;
    rig.wheels.rr.spinPivot.rotation.x = raceState.wheelSpin;
    rig.bodyMesh.rotation.z = -raceState.steerVisual * Math.min(0.06, Math.abs(raceState.speed) * 0.0022);

    // Exhaust particles
    puffTimer += clampedDt;
    if ((usingNitro || Math.abs(raceState.speed) > 9) && puffTimer >= (usingNitro ? 0.045 : 0.11)) {
      puffTimer = 0;
      spawnExhaust(raceState.px, 0, raceState.pz, raceState.pyaw, usingNitro);
    }
    for (const p of puffs) {
      if (p.life <= 0) continue;
      p.life -= clampedDt;
      if (p.life <= 0) {
        p.mesh.visible = false;
      } else {
        p.mesh.position.x += p.vx * clampedDt;
        p.mesh.position.y += p.vy * clampedDt;
        p.mesh.position.z += p.vz * clampedDt;
        p.mesh.scale.multiplyScalar(1 + clampedDt * 1.4);
      }
    }

    // 2. Step 3 AI Rival Racers along circuit spline
    const playerTotalProg =
      (raceState.currentLap - 1) * track.totalLen +
      (raceState.checkpointsHitThisLap === 0 && raceState.trackS > track.totalLen * 0.8 ? 0 : raceState.trackS);

    for (const r of raceState.rivals) {
      if (canDrive) {
        // Gentle catch-up pacing so races remain competitive & fun
        const diff = playerTotalProg - r.totalProgress;
        const paceAdjust = Math.max(-1.6, Math.min(2.4, diff * 0.03));
        const spd = Math.max(17, r.baseSpeed + paceAdjust);
        r.s = (r.s + spd * clampedDt) % track.totalLen;
        r.totalProgress += spd * clampedDt;
        r.lap = Math.max(1, Math.min(raceState.totalLaps + 1, Math.floor(r.totalProgress / track.totalLen) + 1));
        r.wheelSpin += (spd * clampedDt) / r.rig.wheels.wheelR;
      }
      const u = r.s / track.totalLen;
      const idx = Math.floor(u * track.samples.length) % track.samples.length;
      const smp = track.samples[idx];
      const rx = smp.x - smp.tz * r.lane;
      const rz = smp.z + smp.tx * r.lane;
      r.rig.root.position.set(rx, 0, rz);
      r.rig.root.rotation.y = smp.yaw;
      r.rig.wheels.fl.spinPivot.rotation.x = r.wheelSpin;
      r.rig.wheels.fr.spinPivot.rotation.x = r.wheelSpin;
      r.rig.wheels.rl.spinPivot.rotation.x = r.wheelSpin;
      r.rig.wheels.rr.spinPivot.rotation.x = r.wheelSpin;
    }

    // Compute live place (1st..4th)
    if (!raceState.finished) {
      let place = 1;
      for (const r of raceState.rivals) {
        if (r.totalProgress > playerTotalProg) place += 1;
      }
      raceState.place = place;
    }
  }

  function getStatus() {
    const nowMs = performance.now();
    const raceElapsedMs =
      raceState.active && raceState.countdownSec <= 0
        ? Math.max(0, Math.round(nowMs - raceState.startedAtMs))
        : 0;
    const currentLapMs =
      raceState.active && raceState.countdownSec <= 0
        ? Math.max(0, Math.round(nowMs - raceState.lapStartMs))
        : 0;
    return {
      active: raceState.active,
      finished: raceState.finished,
      countdownSec: raceState.countdownSec,
      speedKmh: Math.round(Math.abs(raceState.speed) * 3.6),
      speedLevel: raceState.speedLevel || 4,
      lap: raceState.currentLap,
      totalLaps: raceState.totalLaps,
      place: raceState.place,
      totalRacers: 1 + raceState.rivals.length,
      nitro: Math.round(raceState.nitro),
      nitroActive: raceState.nitroActive,
      onRoad: raceState.onRoad,
      checkpoint: raceState.checkpointsHitThisLap,
      totalCheckpoints: CHECKPOINT_COUNT,
      bestLapMs: raceState.bestLapMs,
      totalMs: raceState.totalMs || raceElapsedMs,
      currentLapMs,
      cameraMode: raceState.cameraMode,
      carName: raceState.carSpec.name,
      px: raceState.px,
      pz: raceState.pz,
      pyaw: raceState.pyaw,
    };
  }

  function setSpeedLevel(level) {
    const lvl = Math.max(1, Math.min(4, Number(level) || 4));
    raceState.speedLevel = lvl;
    return lvl;
  }

  function getInteractiveObjects() {
    const objs = [paddock.gantry];
    for (const s of districtSigns) objs.push(s.group);
    return objs;
  }

  function findNearbyInteractable(px, pz) {
    // Priority: Start/Finish Race Paddock -> District Signposts
    const dPad = Math.hypot(px - startSample.x, pz - startSample.z);
    const dPit = Math.hypot(px - RACE_PADDOCK_POS.x, pz - RACE_PADDOCK_POS.z);
    if (Math.min(dPad, dPit) < 6.4) {
      return { kind: "race_paddock", label: "Enter Island Grand Prix" };
    }
    let nearestSign = null;
    let nearestDist = 4.2;
    for (const ds of districtSigns) {
      const d = Math.hypot(px - ds.x, pz - ds.z);
      if (d < nearestDist) {
        nearestDist = d;
        nearestSign = ds.city;
      }
    }
    if (nearestSign) {
      return {
        kind: "district_sign",
        label: `View ${nearestSign.name}`,
        city: nearestSign,
      };
    }
    return null;
  }

  return {
    root,
    startRace,
    stopRace,
    respawnToTrack,
    toggleCameraMode,
    setSpeedLevel,
    getSpeedLevel: () => raceState.speedLevel || 4,
    setInputs,
    step,
    getStatus,
    getInteractiveObjects,
    findNearbyInteractable,
    districtSigns,
    paddockPos: { x: startSample.x, z: startSample.z },
  };
}

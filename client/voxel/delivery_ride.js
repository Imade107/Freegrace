// Procedural 3D Island Courier Delivery Scooter, Speed Levels (1-4) & Vehicle Kinematics.

import * as THREE from "three";
import { Vox, buildVoxelMesh } from "./vox.js";

export const SPEED_LEVEL_SPECS = Object.freeze({
  1: {
    level: 1,
    name: "Eco",
    subtext: "Safe Alley & Sidewalk Delivery",
    maxSpeedKmh: 32,
    accel: 18,
    handling: 3.8,
    color: "#10b981", // Emerald
  },
  2: {
    level: 2,
    name: "City",
    subtext: "Standard Street Cruise",
    maxSpeedKmh: 58,
    accel: 26,
    handling: 3.2,
    color: "#3b82f6", // Blue
  },
  3: {
    level: 3,
    name: "Express",
    subtext: "Avenue Rush Delivery",
    maxSpeedKmh: 84,
    accel: 36,
    handling: 2.8,
    color: "#f59e0b", // Amber
  },
  4: {
    level: 4,
    name: "Turbo",
    subtext: "Overdrive Hyper Courier",
    maxSpeedKmh: 108,
    accel: 48,
    handling: 2.3,
    color: "#8b5cf6", // Purple
  },
});

export function buildDeliveryScooterRig() {
  const root = new THREE.Group();
  root.name = "delivery_scooter_rig";
  const s = 0.165; // scale

  // 1. Aerodynamic Step-Through Chassis (Voxel Sculpt)
  const chassisVox = new Vox(701);
  const primaryColor = "#0ea5e9"; // vibrant island courier cyan
  const accentColor = "#f59e0b";  // warm courier amber
  const darkMetal = "#1e2430";
  const chrome = "#e2e8f0";

  // Footboard / floor tray
  chassisVox.box(-3, 1, -5, 3, 2, 4, darkMetal);
  // Main body / side cowlings
  chassisVox.box(-3.5, 2, -6, 3.5, 4.5, 2, primaryColor);
  chassisVox.box(-1, 2.2, -5.8, 1, 4.6, 1.8, accentColor); // center stripe
  // Front apron & leg shield
  chassisVox.box(-3, 3, 1.5, 3, 7.5, 3.5, primaryColor);
  chassisVox.box(-1, 3.2, 1.6, 1, 7.6, 3.6, accentColor);
  // Handlebar stem fairing
  chassisVox.box(-1.5, 7.5, 1.8, 1.5, 8.8, 3.2, primaryColor);

  const chassisMesh = buildVoxelMesh(chassisVox, { scale: s, castShadow: true, receiveShadow: true });
  chassisMesh.position.y = 0.05;
  root.add(chassisMesh);

  // 2. Comfortable Driver Saddle
  const seatMat = new THREE.MeshStandardMaterial({
    color: "#181a20",
    roughness: 0.75,
    metalness: 0.1,
  });
  const seatGeo = new THREE.BoxGeometry(4.8 * s, 1.6 * s, 6.2 * s);
  const seatMesh = new THREE.Mesh(seatGeo, seatMat);
  seatMesh.position.set(0, 5.2 * s, -1.8 * s);
  seatMesh.castShadow = true;
  root.add(seatMesh);

  // 3. Chrome Luggage Rack + Insulated Delivery Parcel Crate
  const cargoGroup = new THREE.Group();
  cargoGroup.position.set(0, 5.2 * s, -6.6 * s);

  const rackMat = new THREE.MeshStandardMaterial({
    color: chrome,
    roughness: 0.22,
    metalness: 0.85,
  });
  const rackMesh = new THREE.Mesh(new THREE.BoxGeometry(4.4 * s, 0.4 * s, 4.2 * s), rackMat);
  rackMesh.position.y = -0.2 * s;
  cargoGroup.add(rackMesh);

  // Courier Crate Vox
  const crateVox = new Vox(702);
  crateVox.box(-3, 0, -3, 3, 5, 3, "#f8fafc"); // insulated white/light grey container
  crateVox.box(-3.2, 2.2, -3.2, 3.2, 3.2, 3.2, accentColor); // courier banner wrap
  crateVox.box(-1, 5, -1, 1, 5.4, 1, "#0284c7"); // top handle & lock latch
  const crateMesh = buildVoxelMesh(crateVox, { scale: s * 0.95, castShadow: true, receiveShadow: true });
  crateMesh.position.y = 0;
  cargoGroup.add(crateMesh);

  // Dynamic carried parcel glowing overlay indicator
  const parcelMat = new THREE.MeshStandardMaterial({
    color: "#fbbf24",
    roughness: 0.35,
    metalness: 0.15,
    emissive: "#d97706",
    emissiveIntensity: 0.45,
  });
  const parcelMesh = new THREE.Mesh(new THREE.BoxGeometry(3.6 * s, 2.4 * s, 3.6 * s), parcelMat);
  parcelMesh.position.set(0, 3.6 * s, 0);
  cargoGroup.add(parcelMesh);

  root.add(cargoGroup);

  // 4. Steerable Front Fork & Handlebars
  const frontForkPivot = new THREE.Group();
  frontForkPivot.position.set(0, 1.9 * s, 3.8 * s);

  const barMat = new THREE.MeshStandardMaterial({ color: chrome, roughness: 0.25, metalness: 0.85 });
  const gripMat = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.9 });

  // Steering T-bar
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.22 * s, 7.8 * s, 8), barMat);
  stem.position.set(0, 4.4 * s, 0);
  stem.rotation.x = -0.16; // slight fork rake
  frontForkPivot.add(stem);

  const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.18 * s, 6.8 * s, 8), barMat);
  crossbar.rotation.z = Math.PI * 0.5;
  crossbar.position.set(0, 8.2 * s, -0.6 * s);
  frontForkPivot.add(crossbar);

  // Grips
  const lgrip = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * s, 0.24 * s, 1.4 * s, 8), gripMat);
  lgrip.rotation.z = Math.PI * 0.5;
  lgrip.position.set(-2.8 * s, 8.2 * s, -0.6 * s);
  const rgrip = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * s, 0.24 * s, 1.4 * s, 8), gripMat);
  rgrip.rotation.z = Math.PI * 0.5;
  rgrip.position.set(2.8 * s, 8.2 * s, -0.6 * s);
  frontForkPivot.add(lgrip, rgrip);

  // Mirrors
  const mirrorGeo = new THREE.CylinderGeometry(0.55 * s, 0.55 * s, 0.12 * s, 10);
  mirrorGeo.rotateX(Math.PI * 0.5);
  const lmirror = new THREE.Mesh(mirrorGeo, barMat);
  lmirror.position.set(-3.2 * s, 9.4 * s, -0.8 * s);
  const rmirror = new THREE.Mesh(mirrorGeo, barMat);
  rmirror.position.set(3.2 * s, 9.4 * s, -0.8 * s);
  frontForkPivot.add(lmirror, rmirror);

  // Front Headlight (Round vintage emissive lamp)
  const lampMat = new THREE.MeshStandardMaterial({
    color: "#fffbeb",
    emissive: "#fef08a",
    emissiveIntensity: 1.8,
    roughness: 0.15,
  });
  const headLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.72 * s, 0.72 * s, 0.6 * s, 12), lampMat);
  headLamp.rotation.x = Math.PI * 0.5;
  headLamp.position.set(0, 6.8 * s, 0.7 * s);
  frontForkPivot.add(headLamp);

  // 5. Wheels (Front on fork, Rear on chassis)
  const wheelR = 0.32;
  const wheelW = 0.18;
  const tireGeo = new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 14);
  tireGeo.rotateZ(Math.PI * 0.5);
  const tireMat = new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.88, metalness: 0.05 });

  const rimGeo = new THREE.CylinderGeometry(wheelR * 0.55, wheelR * 0.55, wheelW + 0.015, 10);
  rimGeo.rotateZ(Math.PI * 0.5);
  const rimMat = new THREE.MeshStandardMaterial({ color: chrome, roughness: 0.28, metalness: 0.8 });

  // Front wheel spin group
  const frontSpinGroup = new THREE.Group();
  const fTire = new THREE.Mesh(tireGeo, tireMat);
  fTire.castShadow = true;
  const fRim = new THREE.Mesh(rimGeo, rimMat);
  frontSpinGroup.add(fTire, fRim);
  frontSpinGroup.position.set(0, -wheelR + 0.12 * s, 0);
  frontForkPivot.add(frontSpinGroup);

  root.add(frontForkPivot);

  // Rear wheel spin group
  const rearSpinGroup = new THREE.Group();
  const rTire = new THREE.Mesh(tireGeo, tireMat);
  rTire.castShadow = true;
  const rRim = new THREE.Mesh(rimGeo, rimMat);
  rearSpinGroup.add(rTire, rRim);
  rearSpinGroup.position.set(0, wheelR, -5.2 * s);
  root.add(rearSpinGroup);

  // Tail light (emissive red)
  const tailMat = new THREE.MeshStandardMaterial({
    color: "#ef4444",
    emissive: "#dc2626",
    emissiveIntensity: 1.6,
    roughness: 0.25,
  });
  const tailLamp = new THREE.Mesh(new THREE.BoxGeometry(1.6 * s, 0.7 * s, 0.35 * s), tailMat);
  tailLamp.position.set(0, 3.8 * s, -8.6 * s);
  root.add(tailLamp);

  return {
    root,
    frontForkPivot,
    frontSpinGroup,
    rearSpinGroup,
    cargoGroup,
    parcelMesh,
    headLamp,
    wheelR,
    seatOffset: new THREE.Vector3(0, 5.2 * s, -1.8 * s),
  };
}

export function createDeliveryRideController(scene, getGroundHeightAt) {
  const rig = buildDeliveryScooterRig();
  rig.root.visible = false;
  scene.add(rig.root);

  const state = {
    active: false,
    px: 0,
    py: 0,
    pz: 0,
    pyaw: 0,
    pitch: 0,
    roll: 0,
    speed: 0, // m/s
    speedLevel: 2, // 1: Eco, 2: City, 3: Express, 4: Turbo
    steerVisual: 0,
    wheelSpin: 0,
    hasParcel: false,
    hornTimer: 0,
    turboTrailTimer: 0,
    inputs: {
      forward: false,
      backward: false,
      left: false,
      right: false,
      boost: false,
    },
  };

  function mount(startX, startZ, startYaw = 0) {
    state.active = true;
    state.px = Number(startX) || 0;
    state.pz = Number(startZ) || 0;
    state.pyaw = Number(startYaw) || 0;
    state.speed = 0;
    state.steerVisual = 0;
    state.roll = 0;
    const gy = typeof getGroundHeightAt === "function" ? getGroundHeightAt(state.px, state.pz) : 0;
    state.py = gy;
    rig.root.visible = true;
    rig.root.position.set(state.px, state.py, state.pz);
    rig.root.rotation.set(0, state.pyaw, 0);
    return true;
  }

  function dismount() {
    state.active = false;
    state.speed = 0;
    rig.root.visible = false;
    return {
      x: state.px,
      y: state.py,
      z: state.pz,
      yaw: state.pyaw,
    };
  }

  function setSpeedLevel(level) {
    const lvl = Math.max(1, Math.min(4, Number(level) || 1));
    state.speedLevel = lvl;
    return SPEED_LEVEL_SPECS[lvl];
  }

  function setInputs(inp = {}) {
    state.inputs.forward = Boolean(inp.forward);
    state.inputs.backward = Boolean(inp.backward);
    state.inputs.left = Boolean(inp.left);
    state.inputs.right = Boolean(inp.right);
    state.inputs.boost = Boolean(inp.boost);
  }

  function setParcelLoaded(hasParcel) {
    state.hasParcel = Boolean(hasParcel);
    rig.parcelMesh.visible = state.hasParcel;
  }

  function beepHorn() {
    state.hornTimer = 0.35;
  }

  function step(dt, obstacles = [], ponds = [], weatherMult = 1.0) {
    if (!state.active) return;
    const clampedDt = Math.max(0.001, Math.min(0.08, Number(dt) || 0.016));
    const spec = SPEED_LEVEL_SPECS[state.speedLevel] || SPEED_LEVEL_SPECS[2];

    const maxFwdSpeed = (spec.maxSpeedKmh / 3.6) * weatherMult;
    const accelRate = spec.accel * (state.inputs.boost ? 1.25 : 1.0);

    // 1. Throttle / Brake
    if (state.inputs.forward) {
      state.speed += accelRate * clampedDt;
    } else if (state.inputs.backward) {
      if (state.speed > 0.8) {
        state.speed -= accelRate * 2.2 * clampedDt; // strong disk braking
      } else {
        state.speed -= accelRate * 0.45 * clampedDt; // slow reverse
      }
    } else {
      // Coasting drag
      const drag = Math.exp(-1.95 * clampedDt);
      state.speed *= drag;
      if (Math.abs(state.speed) < 0.06) state.speed = 0;
    }

    const maxRevSpeed = -5.5;
    state.speed = Math.max(maxRevSpeed, Math.min(maxFwdSpeed, state.speed));

    // 2. Steering & Leaning
    let steerDir = 0;
    if (state.inputs.left) steerDir += 1;
    if (state.inputs.right) steerDir -= 1;

    state.steerVisual += (steerDir - state.steerVisual) * Math.min(1, clampedDt * 10);

    const speedFactor = Math.min(1, Math.abs(state.speed) / 7.2);
    const turnRate = spec.handling * (0.4 + 0.6 * speedFactor);
    const revSign = state.speed >= -0.1 ? 1 : -1;

    if (Math.abs(state.speed) > 0.15) {
      state.pyaw += steerDir * revSign * turnRate * clampedDt;
    }

    // Leaning banking angle
    const targetRoll = -state.steerVisual * Math.min(0.24, Math.abs(state.speed) * 0.018);
    state.roll += (targetRoll - state.roll) * Math.min(1, clampedDt * 8.5);

    // 3. Position update
    const fwdX = -Math.sin(state.pyaw);
    const fwdZ = -Math.cos(state.pyaw);
    state.px += fwdX * state.speed * clampedDt;
    state.pz += fwdZ * state.speed * clampedDt;

    // Island shore clamp
    const rSq = state.px * state.px + state.pz * state.pz;
    const maxR = 142;
    if (rSq > maxR * maxR) {
      const curR = Math.sqrt(rSq);
      state.px = (state.px / curR) * maxR;
      state.pz = (state.pz / curR) * maxR;
      state.speed *= 0.4;
    }

    // Obstacle avoidance
    const scooterR = 0.95;
    for (const obs of obstacles) {
      const dx = state.px - obs.x;
      const dz = state.pz - obs.z;
      const minD = (obs.r || 1.8) + scooterR;
      const dist = Math.hypot(dx, dz);
      if (dist < minD && dist > 0.001) {
        const push = minD - dist;
        state.px += (dx / dist) * push;
        state.pz += (dz / dist) * push;
        state.speed *= 0.65;
      }
    }

    // Ground clamping
    const gy = typeof getGroundHeightAt === "function" ? getGroundHeightAt(state.px, state.pz) : 0;
    state.py += (gy - state.py) * Math.min(1, clampedDt * 18);

    // 4. Visual updates
    rig.root.position.set(state.px, state.py, state.pz);
    rig.root.rotation.order = "YXZ";
    rig.root.rotation.set(0, state.pyaw, state.roll);

    // Fork and wheel rotation
    rig.frontForkPivot.rotation.y = -state.steerVisual * 0.38;
    state.wheelSpin += (state.speed * clampedDt) / rig.wheelR;
    rig.frontSpinGroup.rotation.x = state.wheelSpin;
    rig.rearSpinGroup.rotation.x = state.wheelSpin;

    if (state.hornTimer > 0) {
      state.hornTimer -= clampedDt;
    }
  }

  function getStatus() {
    const spec = SPEED_LEVEL_SPECS[state.speedLevel] || SPEED_LEVEL_SPECS[2];
    const kmh = Math.round(Math.abs(state.speed) * 3.6);
    return {
      active: state.active,
      px: state.px,
      py: state.py,
      pz: state.pz,
      pyaw: state.pyaw,
      speed: state.speed,
      speedKmh: kmh,
      speedLevel: state.speedLevel,
      speedLevelName: spec.name,
      speedLevelColor: spec.color,
      maxKmh: spec.maxSpeedKmh,
      hasParcel: state.hasParcel,
    };
  }

  return {
    mount,
    dismount,
    isMounted: () => state.active,
    setSpeedLevel,
    getSpeedLevel: () => state.speedLevel,
    setInputs,
    setParcelLoaded,
    beepHorn,
    step,
    getStatus,
    getRig: () => rig,
  };
}

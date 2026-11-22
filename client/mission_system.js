// Delivery Mission & Courier Dispatch System for GeminIsland.

import { addCredits, getEconomyState } from "./player_economy.js";

const STATS_STORAGE_KEY = "geminisland_courier_stats_v1";

const CARGO_BY_ORIGIN = [
  { re: /bakery|windmill/i, cargo: "Warm Sourdough Crates", title: "Bakery Morning Run" },
  { re: /ramen|yatai/i, cargo: "Insulated Ramen Carrier", title: "Hot Noodle Express" },
  { re: /pizza/i, cargo: "Wood-Fired Pizza Stack", title: "Fresh Slice Dispatch" },
  { re: /gelato|gelateria|cono/i, cargo: "Chilled Gelato Tub", title: "Cold-Chain Treat Run" },
  { re: /bookshop|matcha|library/i, cargo: "Rare Folio & Matcha Box", title: "Bookshop Parcel" },
  { re: /hospital|clinic|med/i, cargo: "Medical Supply Case", title: "Priority Med Courier" },
  { re: /police|safety|lifeguard|maritime|ranger/i, cargo: "Patrol Beacon Kit", title: "Safety Logistics Drop" },
  { re: /station|clocktower/i, cargo: "Express Mail Satchel", title: "Station Mailbag" },
  { re: /bicycle|skate|shop/i, cargo: "Tune-Up Parts Crate", title: "Workshop Parts Run" },
  { re: /quarry|mineral/i, cargo: "Core Sample Box", title: "Quarry Dispatch" },
];

const FALLBACK_CARGOS = [
  { cargo: "Sealed Island Parcel", title: "Town Courier Run" },
  { cargo: "Community Tool Crate", title: "Meadow Supply Drop" },
  { cargo: "Registered Mail Pouch", title: "Express Dispatch" },
  { cargo: "Fresh Herb Basket", title: "Garden Market Run" },
];

function playToneSequence(freqs) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!playToneSequence._ctx) {
      playToneSequence._ctx = new AudioCtx();
    }
    const ctx = playToneSequence._ctx;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }
    const baseTime = ctx.currentTime + 0.01;
    freqs.forEach(([freq, dur, delay], idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, baseTime + delay);
      gain.gain.setValueAtTime(0.0001, baseTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.075, baseTime + delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, baseTime + delay + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(baseTime + delay);
      osc.stop(baseTime + delay + dur + 0.02);
      if (idx === 0) void freq;
    });
  } catch {
    // Ignore audio context restrictions
  }
}

function loadSavedStats() {
  const sharedCredits = getEconomyState().credits;
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        deliveries: Math.max(0, Number(parsed.deliveries) || 0),
        credits: sharedCredits,
        streak: Math.max(0, Number(parsed.streak) || 0),
      };
    }
  } catch {
    // Sandboxed iframe without localStorage
  }
  return { deliveries: 0, credits: sharedCredits, streak: 0 };
}

function saveStats(stats) {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage restriction
  }
}

function pickCargoForOrigin(originName, seedIdx = 0) {
  for (const rule of CARGO_BY_ORIGIN) {
    if (rule.re.test(originName || "")) {
      return { cargo: rule.cargo, title: rule.title };
    }
  }
  return FALLBACK_CARGOS[seedIdx % FALLBACK_CARGOS.length];
}

function getEligibleLandmarks(worldData) {
  const creations = Array.isArray(worldData?.creations) ? worldData.creations : [];
  return creations.filter(
    (c) =>
      c &&
      !c.isCompanion &&
      (c.category === "building" || c.behavior?.type === "landmark") &&
      typeof c.x === "number" &&
      typeof c.z === "number" &&
      Math.hypot(c.x, c.z) <= 155,
  );
}

export function createDeliveryMissionController(options = {}) {
  const { engine, onStateChange, onMissionToast } = options;

  let worldData = null;
  let stats = loadSavedStats();
  let availableMissions = [];
  let activeMission = null;
  let lastCompletionSummary = null;
  let liveProgress = {
    distMeters: null,
    focusDistMeters: null,
    relBearingRad: 0,
    inRange: false,
    remainingBonusSec: 0,
  };
  let boardSeed = 1;

  function emitChange() {
    onStateChange?.(getState());
  }

  function buildBoard(preferSeed = boardSeed) {
    const landmarks = getEligibleLandmarks(worldData);
    if (landmarks.length < 2) {
      availableMissions = [];
      return availableMissions;
    }

    const status = engine?.getDeliveryStatus?.();
    const px = status?.playerX ?? 0;
    const pz = status?.playerZ ?? 0;

    // Prioritize recognizable town buildings first, sorted loosely around island
    const civicRe = /bakery|hospital|station|bookshop|ramen|pizza|gelateria|library|ranger|safety|maritime|bicycle|observatory|quarry|school/i;
    const pool = [...landmarks].sort((a, b) => {
      const aC = civicRe.test(a.name) ? 0 : 1;
      const bC = civicRe.test(b.name) ? 0 : 1;
      if (aC !== bC) return aC - bC;
      return a.name.localeCompare(b.name);
    });

    const out = [];
    const usedPairs = new Set();

    // Target 3 diverse distances: quick nearby pickup (~35-70m), mid-town (~70-120m), cross-island (~115-185m)
    const buckets = [
      { minD: 34, maxD: 74, urgency: "standard" },
      { minD: 70, maxD: 122, urgency: "priority" },
      { minD: 112, maxD: 195, urgency: "express" },
    ];

    for (let bIdx = 0; bIdx < buckets.length; bIdx++) {
      const bucket = buckets[bIdx];
      let chosen = null;

      for (let attempt = 0; attempt < pool.length * 2; attempt++) {
        const originIdx = (preferSeed * 5 + bIdx * 7 + attempt) % pool.length;
        const origin = pool[originIdx];
        // Pick an origin reasonably accessible from player on slot 0
        if (bIdx === 0 && attempt < pool.length && Math.hypot(origin.x - px, origin.z - pz) > 95) {
          continue;
        }
        for (let step = 1; step < pool.length; step++) {
          const destIdx = (originIdx + step * 3 + preferSeed + bIdx) % pool.length;
          const dest = pool[destIdx];
          if (!dest || dest.id === origin.id) continue;
          const pairKey = `${origin.id}->${dest.id}`;
          if (usedPairs.has(pairKey)) continue;
          const dist = Math.hypot(dest.x - origin.x, dest.z - origin.z);
          if (dist >= bucket.minD && dist <= bucket.maxD) {
            usedPairs.add(pairKey);
            const meta = pickCargoForOrigin(origin.name, bIdx + preferSeed);
            const timeLimitSec = Math.round(75 + dist * 0.9);
            const rewardCredits =
              (bucket.urgency === "express" ? 95 : bucket.urgency === "priority" ? 70 : 50) +
              Math.round(dist * 0.35);
            chosen = {
              id: `dlv-${origin.id.slice(-5)}-${dest.id.slice(-5)}-${preferSeed}`,
              title: meta.title,
              cargo: meta.cargo,
              urgency: bucket.urgency,
              pickupId: origin.id,
              pickupName: origin.name,
              pickupX: origin.x,
              pickupZ: origin.z,
              dropoffId: dest.id,
              dropoffName: dest.name,
              dropoffX: dest.x,
              dropoffZ: dest.z,
              routeDistance: Math.round(dist),
              timeLimitSec,
              rewardCredits,
              brief: `Pick up ${meta.cargo.toLowerCase()} outside ${origin.name} and bring it to ${dest.name}.`,
              source: "board",
            };
            break;
          }
        }
        if (chosen) break;
      }

      if (!chosen && pool.length >= 2) {
        const origin = pool[(preferSeed + bIdx) % pool.length];
        const dest = pool[(preferSeed + bIdx + 1) % pool.length];
        const dist = Math.max(30, Math.round(Math.hypot(dest.x - origin.x, dest.z - origin.z)));
        const meta = pickCargoForOrigin(origin.name, bIdx);
        chosen = {
          id: `dlv-fallback-${bIdx}-${preferSeed}`,
          title: meta.title,
          cargo: meta.cargo,
          urgency: bucket.urgency,
          pickupId: origin.id,
          pickupName: origin.name,
          pickupX: origin.x,
          pickupZ: origin.z,
          dropoffId: dest.id,
          dropoffName: dest.name,
          dropoffX: dest.x,
          dropoffZ: dest.z,
          routeDistance: dist,
          timeLimitSec: Math.round(80 + dist * 0.9),
          rewardCredits: 55 + Math.round(dist * 0.35),
          brief: `Collect ${meta.cargo.toLowerCase()} at ${origin.name} and deliver to ${dest.name}.`,
          source: "board",
        };
      }

      if (chosen) out.push(chosen);
    }

    availableMissions = out;
    return out;
  }

  function refreshBoard() {
    boardSeed += 1;
    buildBoard(boardSeed);
    emitChange();
  }

  function setWorldData(nextWorld) {
    worldData = nextWorld;
    if (availableMissions.length === 0) {
      buildBoard(boardSeed);
    }
    emitChange();
  }

  function syncWaypointToEngine() {
    if (!activeMission) {
      engine?.setCarryingParcel?.(false);
      engine?.setDeliveryWaypoint?.(null);
      return;
    }
    if (activeMission.phase === "to_pickup") {
      engine?.setCarryingParcel?.(false);
      const spot = engine?.setDeliveryWaypoint?.({
        kind: "pickup",
        creationId: activeMission.pickupId,
        x: activeMission.pickupX,
        z: activeMission.pickupZ,
        label: `Pick up ${activeMission.cargo}`,
      });
      if (spot) {
        activeMission.waypointX = spot.x;
        activeMission.waypointZ = spot.z;
      }
    } else {
      engine?.setCarryingParcel?.(true);
      const spot = engine?.setDeliveryWaypoint?.({
        kind: "dropoff",
        creationId: activeMission.dropoffId,
        x: activeMission.dropoffX,
        z: activeMission.dropoffZ,
        label: `Deliver ${activeMission.cargo}`,
      });
      if (spot) {
        activeMission.waypointX = spot.x;
        activeMission.waypointZ = spot.z;
      }
    }
  }

  function acceptMission(spec, options = {}) {
    if (!spec || !spec.pickupId || !spec.dropoffId) return null;
    const now = Date.now();
    const dist =
      typeof spec.routeDistance === "number"
        ? spec.routeDistance
        : Math.round(
            Math.hypot(
              (spec.dropoffX || 0) - (spec.pickupX || 0),
              (spec.dropoffZ || 0) - (spec.pickupZ || 0),
            ),
          );

    activeMission = {
      id: spec.id || `dlv-${now.toString(36)}`,
      title: spec.title || "Courier Dispatch",
      cargo: spec.cargo || "Delivery Parcel",
      urgency: spec.urgency || "standard",
      pickupId: spec.pickupId,
      pickupName: spec.pickupName,
      pickupX: spec.pickupX,
      pickupZ: spec.pickupZ,
      dropoffId: spec.dropoffId,
      dropoffName: spec.dropoffName,
      dropoffX: spec.dropoffX,
      dropoffZ: spec.dropoffZ,
      routeDistance: dist,
      timeLimitSec: spec.timeLimitSec || Math.max(90, Math.round(75 + dist * 0.9)),
      rewardCredits: spec.rewardCredits || 55 + Math.round(dist * 0.35),
      brief: spec.brief || "",
      source: options.source || spec.source || "board",
      phase: "to_pickup",
      startedAt: now,
      pickedUpAt: null,
      waypointX: spec.pickupX,
      waypointZ: spec.pickupZ,
    };
    lastCompletionSummary = null;
    syncWaypointToEngine();
    updateProgress();
    if (!options.silent) {
      onMissionToast?.(
        `Delivery accepted: Pick up ${activeMission.cargo} at ${activeMission.pickupName}`,
      );
    }
    if (options.focusCamera !== false && !engine?.isFirstPerson?.()) {
      engine?.focusOn?.(
        activeMission.waypointX ?? activeMission.pickupX,
        activeMission.waypointZ ?? activeMission.pickupZ,
        1.45,
      );
    }
    emitChange();
    return activeMission;
  }

  function completeCurrentStep() {
    if (!activeMission) return false;
    if (activeMission.phase === "to_pickup") {
      activeMission.phase = "to_dropoff";
      activeMission.pickedUpAt = Date.now();
      syncWaypointToEngine();
      updateProgress();
      playToneSequence([
        [523.25, 0.11, 0],
        [659.25, 0.14, 0.08],
      ]);
      onMissionToast?.(
        `Parcel picked up! Deliver ${activeMission.cargo} to ${activeMission.dropoffName}.`,
      );
      if (!engine?.isFirstPerson?.()) {
        engine?.focusOn?.(
          activeMission.waypointX ?? activeMission.dropoffX,
          activeMission.waypointZ ?? activeMission.dropoffZ,
          1.35,
        );
      }
      emitChange();
      return true;
    }

    // Complete delivery!
    const elapsedSec = Math.max(1, Math.round((Date.now() - activeMission.startedAt) / 1000));
    const speedBonus = elapsedSec <= activeMission.timeLimitSec ? 25 : 0;
    const totalEarned = activeMission.rewardCredits + speedBonus;

    const updatedCredits = addCredits(totalEarned);
    stats = {
      deliveries: stats.deliveries + 1,
      credits: updatedCredits,
      streak: speedBonus > 0 ? stats.streak + 1 : 1,
    };
    saveStats(stats);

    lastCompletionSummary = {
      title: activeMission.title,
      cargo: activeMission.cargo,
      dropoffName: activeMission.dropoffName,
      earned: totalEarned,
      speedBonus,
      elapsedSec,
      ts: Date.now(),
    };

    const doneName = activeMission.dropoffName;
    const doneCargo = activeMission.cargo;
    activeMission = null;
    engine?.setCarryingParcel?.(false);
    engine?.setDeliveryWaypoint?.(null);
    playToneSequence([
      [587.33, 0.11, 0],
      [783.99, 0.12, 0.09],
      [1046.5, 0.22, 0.18],
    ]);
    onMissionToast?.(
      `Delivered ${doneCargo} to ${doneName}! +${totalEarned} credits${speedBonus > 0 ? " (Speed Bonus)" : ""}`,
      5000,
    );
    boardSeed += 1;
    buildBoard(boardSeed);
    emitChange();
    return true;
  }

  function cancelMission() {
    if (!activeMission) return false;
    activeMission = null;
    engine?.setCarryingParcel?.(false);
    engine?.setDeliveryWaypoint?.(null);
    liveProgress = {
      distMeters: null,
      focusDistMeters: null,
      relBearingRad: 0,
      inRange: false,
      remainingBonusSec: 0,
    };
    onMissionToast?.("Delivery cancelled.");
    emitChange();
    return true;
  }

  function focusCurrentWaypoint() {
    if (!activeMission) return false;
    const tx =
      activeMission.waypointX ??
      (activeMission.phase === "to_pickup" ? activeMission.pickupX : activeMission.dropoffX);
    const tz =
      activeMission.waypointZ ??
      (activeMission.phase === "to_pickup" ? activeMission.pickupZ : activeMission.dropoffZ);
    if (engine?.isFirstPerson?.()) {
      engine?.setDragMode?.("pan");
    }
    engine?.focusOn?.(tx, tz, 1.55);
    return true;
  }

  function updateProgress() {
    if (!activeMission) {
      liveProgress = {
        distMeters: null,
        focusDistMeters: null,
        relBearingRad: 0,
        inRange: false,
        remainingBonusSec: 0,
      };
      return liveProgress;
    }
    const status = engine?.getDeliveryStatus?.();
    const elapsedSec = Math.floor((Date.now() - activeMission.startedAt) / 1000);
    liveProgress = {
      distMeters:
        typeof status?.distMeters === "number" ? Math.round(status.distMeters) : null,
      focusDistMeters:
        typeof status?.focusDistMeters === "number" ? Math.round(status.focusDistMeters) : null,
      relBearingRad: typeof status?.relBearingRad === "number" ? status.relBearingRad : 0,
      inRange: Boolean(status?.inRange),
      remainingBonusSec: Math.max(0, activeMission.timeLimitSec - elapsedSec),
    };
    return liveProgress;
  }

  function getState() {
    return {
      stats: { ...stats, credits: getEconomyState().credits },
      activeMission: activeMission ? { ...activeMission } : null,
      liveProgress: { ...liveProgress },
      availableMissions: availableMissions.map((m) => ({ ...m })),
      lastCompletionSummary: lastCompletionSummary ? { ...lastCompletionSummary } : null,
    };
  }

  function getPoliceContext() {
    if (!activeMission) return null;
    return {
      title: activeMission.title,
      phase: activeMission.phase,
      cargo: activeMission.cargo,
      pickupName: activeMission.pickupName,
      dropoffName: activeMission.dropoffName,
      distanceMeters: liveProgress.distMeters ?? undefined,
    };
  }

  return {
    setWorldData,
    refreshBoard,
    acceptMission,
    completeCurrentStep,
    cancelMission,
    focusCurrentWaypoint,
    updateProgress,
    getState,
    getPoliceContext,
  };
}

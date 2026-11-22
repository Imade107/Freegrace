// Shared Island Wallet, Inventory, Shop Unlocks & Race Records for GeminIsland.

const ECONOMY_STORAGE_KEY = "geminisland_economy_v1";
const LEGACY_STATS_KEY = "geminisland_courier_stats_v1";

const STARTER_CREDITS = 120;

const DEFAULT_STATE = Object.freeze({
  credits: STARTER_CREDITS,
  unlockedCars: ["roadster"],
  selectedCar: "roadster",
  ownedItems: [],
  consumables: {},
  equippedGear: {},
  raceUpgrades: {
    topSpeedLevel: 0,
    nitroLevel: 0,
    gripLevel: 0,
  },
  walkBoostUntil: 0,
  bestLapMs: null,
  raceWins: 0,
  totalRaces: 0,
  pondWishAt: 0,
});

function sanitizeState(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const unlocked = Array.isArray(s.unlockedCars)
    ? [...new Set(["roadster", ...s.unlockedCars.filter((id) => typeof id === "string")])]
    : ["roadster"];
  const selectedCar =
    typeof s.selectedCar === "string" && unlocked.includes(s.selectedCar)
      ? s.selectedCar
      : "roadster";

  const ownedItems = Array.isArray(s.ownedItems)
    ? [...new Set(s.ownedItems.filter((id) => typeof id === "string"))]
    : [];

  const consumables = {};
  if (s.consumables && typeof s.consumables === "object") {
    for (const [k, v] of Object.entries(s.consumables)) {
      if (typeof k === "string" && Number.isFinite(Number(v)) && Number(v) > 0) {
        consumables[k] = Math.min(99, Math.floor(Number(v)));
      }
    }
  }

  const equippedGear =
    s.equippedGear && typeof s.equippedGear === "object" ? { ...s.equippedGear } : {};

  const up = s.raceUpgrades && typeof s.raceUpgrades === "object" ? s.raceUpgrades : {};
  return {
    credits: Math.max(0, Math.round(Number(s.credits) || 0)),
    unlockedCars: unlocked,
    selectedCar,
    ownedItems,
    consumables,
    equippedGear,
    raceUpgrades: {
      topSpeedLevel: Math.max(0, Math.min(3, Math.round(Number(up.topSpeedLevel) || 0))),
      nitroLevel: Math.max(0, Math.min(3, Math.round(Number(up.nitroLevel) || 0))),
      gripLevel: Math.max(0, Math.min(3, Math.round(Number(up.gripLevel) || 0))),
    },
    walkBoostUntil: Math.max(0, Number(s.walkBoostUntil) || 0),
    bestLapMs:
      typeof s.bestLapMs === "number" && Number.isFinite(s.bestLapMs) && s.bestLapMs > 1000
        ? Math.round(s.bestLapMs)
        : null,
    raceWins: Math.max(0, Math.round(Number(s.raceWins) || 0)),
    totalRaces: Math.max(0, Math.round(Number(s.totalRaces) || 0)),
    pondWishAt: Math.max(0, Number(s.pondWishAt) || 0),
  };
}

function loadInitialState() {
  try {
    const raw = localStorage.getItem(ECONOMY_STORAGE_KEY);
    if (raw) {
      return sanitizeState(JSON.parse(raw));
    }
  } catch {
    // Ignore storage restriction
  }

  // Migrate legacy delivery credits if user already played prior session
  let initialCredits = STARTER_CREDITS;
  try {
    const legacyRaw = localStorage.getItem(LEGACY_STATS_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      const legacyCreds = Math.max(0, Math.round(Number(parsed?.credits) || 0));
      if (legacyCreds > 0) {
        initialCredits = STARTER_CREDITS + legacyCreds;
      }
    }
  } catch {
    // Ignore
  }
  return sanitizeState({ ...DEFAULT_STATE, credits: initialCredits });
}

let state = loadInitialState();
const listeners = new Set();

function persist() {
  try {
    localStorage.setItem(ECONOMY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage restriction
  }
}

function emit() {
  const snap = getEconomyState();
  for (const fn of listeners) {
    try {
      fn(snap);
    } catch {
      // Ignore subscriber errors
    }
  }
}

export function getEconomyState() {
  return {
    credits: state.credits,
    unlockedCars: [...state.unlockedCars],
    selectedCar: state.selectedCar,
    ownedItems: [...state.ownedItems],
    consumables: { ...state.consumables },
    equippedGear: { ...state.equippedGear },
    raceUpgrades: { ...state.raceUpgrades },
    walkBoostUntil: state.walkBoostUntil,
    walkSpeedMultiplier: state.walkBoostUntil > Date.now() ? 1.38 : 1.0,
    bestLapMs: state.bestLapMs,
    raceWins: state.raceWins,
    totalRaces: state.totalRaces,
    pondWishAt: state.pondWishAt,
  };
}

export function subscribeEconomy(fn) {
  if (typeof fn !== "function") return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function addCredits(amount) {
  const delta = Math.round(Number(amount) || 0);
  if (delta <= 0) return state.credits;
  state.credits = Math.min(999_999, state.credits + delta);
  persist();
  emit();
  return state.credits;
}

export function spendCredits(amount) {
  const cost = Math.round(Number(amount) || 0);
  if (cost <= 0 || state.credits < cost) return false;
  state.credits -= cost;
  persist();
  emit();
  return true;
}

export function hasCarUnlocked(carId) {
  return state.unlockedCars.includes(carId);
}

export function selectCar(carId) {
  if (!state.unlockedCars.includes(carId)) return false;
  state.selectedCar = carId;
  persist();
  emit();
  return true;
}

export function buyShopItem(item) {
  if (!item || typeof item.id !== "string") {
    return { ok: false, reason: "Item unavailable." };
  }
  const price = Math.max(1, Math.round(Number(item.price) || 0));

  if (item.kind === "car_unlock") {
    if (state.unlockedCars.includes(item.carId)) {
      state.selectedCar = item.carId;
      persist();
      emit();
      return { ok: true, alreadyOwned: true, item, state: getEconomyState() };
    }
    if (state.credits < price) {
      return { ok: false, reason: `Need ${price - state.credits} more cr.` };
    }
    state.credits -= price;
    state.unlockedCars = [...new Set([...state.unlockedCars, item.carId])];
    state.selectedCar = item.carId;
    if (!state.ownedItems.includes(item.id)) state.ownedItems.push(item.id);
    persist();
    emit();
    return { ok: true, item, state: getEconomyState() };
  }

  if (item.kind === "avatar") {
    if (state.ownedItems.includes(item.id)) {
      return equipShopItem(item);
    }
    if (state.credits < price) {
      return { ok: false, reason: `Need ${price - state.credits} more cr.` };
    }
    state.credits -= price;
    state.ownedItems = [...new Set([...state.ownedItems, item.id])];
    if (item.slot) {
      state.equippedGear[item.slot] = item.id;
    }
    persist();
    emit();
    return {
      ok: true,
      item,
      appearancePatch: item.appearancePatch || null,
      state: getEconomyState(),
    };
  }

  if (item.kind === "race_upgrade") {
    if (state.ownedItems.includes(item.id)) {
      return { ok: false, reason: "Upgrade already installed." };
    }
    if (state.credits < price) {
      return { ok: false, reason: `Need ${price - state.credits} more cr.` };
    }
    state.credits -= price;
    state.ownedItems = [...new Set([...state.ownedItems, item.id])];
    if (item.upgradeKey && Object.hasOwn(state.raceUpgrades, item.upgradeKey)) {
      state.raceUpgrades[item.upgradeKey] = Math.min(3, (state.raceUpgrades[item.upgradeKey] || 0) + 1);
    }
    persist();
    emit();
    return { ok: true, item, state: getEconomyState() };
  }

  // Consumables & walk/sprint boosts
  if (state.credits < price) {
    return { ok: false, reason: `Need ${price - state.credits} more cr.` };
  }
  state.credits -= price;
  if (item.kind === "walk_boost") {
    const durationMs = Math.max(15_000, Number(item.durationMs) || 90_000);
    state.walkBoostUntil = Math.max(state.walkBoostUntil, Date.now()) + durationMs;
    persist();
    emit();
    return { ok: true, item, activatedBoost: true, state: getEconomyState() };
  }

  state.consumables[item.id] = (state.consumables[item.id] || 0) + 1;
  persist();
  emit();
  return { ok: true, item, state: getEconomyState() };
}

export function equipShopItem(item) {
  if (!item || !state.ownedItems.includes(item.id)) {
    return { ok: false, reason: "Buy item first." };
  }
  if (item.slot) {
    state.equippedGear[item.slot] = item.id;
  }
  persist();
  emit();
  return {
    ok: true,
    equipped: true,
    item,
    appearancePatch: item.appearancePatch || null,
    state: getEconomyState(),
  };
}

export function useConsumable(item) {
  if (!item || (state.consumables[item.id] || 0) <= 0) {
    return { ok: false, reason: "Out of stock." };
  }
  state.consumables[item.id] -= 1;
  if (state.consumables[item.id] <= 0) {
    delete state.consumables[item.id];
  }
  if (item.effect === "walk_boost") {
    const durationMs = Math.max(15_000, Number(item.durationMs) || 75_000);
    state.walkBoostUntil = Math.max(state.walkBoostUntil, Date.now()) + durationMs;
  }
  persist();
  emit();
  return { ok: true, item, state: getEconomyState() };
}

export function recordRaceOutcome({ bestLapMs, place }) {
  state.totalRaces += 1;
  if (place === 1) {
    state.raceWins += 1;
  }
  if (typeof bestLapMs === "number" && Number.isFinite(bestLapMs) && bestLapMs > 1000) {
    if (state.bestLapMs === null || bestLapMs < state.bestLapMs) {
      state.bestLapMs = Math.round(bestLapMs);
    }
  }
  persist();
  emit();
  return getEconomyState();
}

export function tryPondWish() {
  const now = Date.now();
  const cooldownMs = 60_000;
  const elapsed = now - (state.pondWishAt || 0);
  if (elapsed < cooldownMs) {
    const remainSec = Math.ceil((cooldownMs - elapsed) / 1000);
    return { ok: false, remainSec };
  }
  state.pondWishAt = now;
  const reward = 5;
  state.credits = Math.min(999_999, state.credits + reward);
  persist();
  emit();
  return { ok: true, reward, credits: state.credits };
}

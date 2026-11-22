// City Districts, Landmarks, Selectable Race Cars & Storefront Shop Catalog for GeminIsland.

export const RACE_PADDOCK_POS = Object.freeze({ x: 78, z: 4 });

export const ISLAND_CITIES = Object.freeze([
  {
    id: "central_square",
    name: "Central Town Square",
    subtitle: "Civic plaza, Windmill Bakery & Town Hall",
    accent: "#3a7d44",
    badge: "Downtown",
    centerX: 0,
    centerZ: 0,
    spawnX: 2,
    spawnZ: 12,
    signX: 11.5,
    signZ: 11.5,
    radius: 44,
    keywords: /town hall|clocktower|bakery|bookshop|police|fire station|courthouse|post office|ice cream|gelateria|toyshop|candy|pizza/i,
  },
  {
    id: "westmeadow_harbor",
    name: "Westmeadow Harbor",
    subtitle: "Sunset piers, canal market & ramen alley",
    accent: "#2d7d9a",
    badge: "Harbor",
    centerX: -64,
    centerZ: 4,
    spawnX: -54,
    spawnZ: 8,
    signX: -56,
    signZ: 16,
    radius: 52,
    keywords: /harbor|pier|maritime|lighthouse|boat|ferry|canal|ramen|westmeadow|beach|shack|bicycle/i,
  },
  {
    id: "north_spaceport",
    name: "North Tech Spaceport",
    subtitle: "Rocket launchpad, observatory & planetarium",
    accent: "#5b5ea6",
    badge: "Sci-Tech",
    centerX: 4,
    centerZ: -74,
    spawnX: 4,
    spawnZ: -64,
    signX: 12,
    signZ: -68,
    radius: 52,
    keywords: /rocket|space|observatory|planetarium|telescope|dome|airfield|station|tech|cyber|monorail/i,
  },
  {
    id: "quarryside_springs",
    name: "Quarryside Springs",
    subtitle: "Mountain trails, mineral quarry & alpine lodge",
    accent: "#8f6239",
    badge: "Highlands",
    centerX: -62,
    centerZ: -62,
    spawnX: -52,
    spawnZ: -52,
    signX: -54,
    signZ: -58,
    radius: 48,
    keywords: /quarry|alpine|ski|cabin|mill|lantern|tea|botanical|conservatory|ranger|greenhouse/i,
  },
  {
    id: "southside_beacon",
    name: "Southside Beacon",
    subtitle: "Medical campus, skate plaza & cliff overlook",
    accent: "#c85a32",
    badge: "South Ward",
    centerX: 6,
    centerZ: 74,
    spawnX: 6,
    spawnZ: 60,
    signX: 14,
    signZ: 58,
    radius: 48,
    keywords: /hospital|university|skate|park|cinema|amphitheater|theater|plaza|villa|gazebo/i,
  },
  {
    id: "suncoast_circuit",
    name: "Suncoast East Circuit",
    subtitle: "Grand Prix start paddock, boardwalk & beach",
    accent: "#d97724",
    badge: "Circuit",
    centerX: 74,
    centerZ: 8,
    spawnX: 68,
    spawnZ: 6,
    signX: 73,
    signZ: -5,
    radius: 52,
    keywords: /paddock|race|boardwalk|coaster|arcade|docks|tavern|pizzeria|bakery|ferris/i,
  },
]);

export function getDistrictAt(x, z) {
  const px = Number(x) || 0;
  const pz = Number(z) || 0;
  let best = ISLAND_CITIES[0];
  let bestScore = Infinity;
  for (const city of ISLAND_CITIES) {
    const d = Math.hypot(px - city.centerX, pz - city.centerZ);
    const normalized = d / (city.radius || 48);
    if (normalized < bestScore) {
      bestScore = normalized;
      best = city;
    }
  }
  return best;
}

export function buildCitiesWithWorldData(worldData, playerX = 0, playerZ = 0) {
  const creations = Array.isArray(worldData?.creations) ? worldData.creations : [];
  const buildings = creations.filter(
    (c) => c && !c.isCompanion && (c.category === "building" || c.behavior?.type === "landmark"),
  );

  return ISLAND_CITIES.map((city) => {
    const localBuildings = [];
    for (const b of buildings) {
      const dist = Math.hypot((b.x || 0) - city.centerX, (b.z || 0) - city.centerZ);
      const assigned = getDistrictAt(b.x || 0, b.z || 0);
      if (assigned.id === city.id || dist <= city.radius * 0.92) {
        localBuildings.push(b);
      }
    }

    const sortedLandmarks = [...localBuildings].sort((a, b) => {
      const aMatch = city.keywords.test(a.name || "") ? 0 : 1;
      const bMatch = city.keywords.test(b.name || "") ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return Math.hypot((a.x || 0) - city.centerX, (a.z || 0) - city.centerZ) -
        Math.hypot((b.x || 0) - city.centerX, (b.z || 0) - city.centerZ);
    });

    const cityStores = SHOP_STORES.filter((store) => store.cityId === city.id);
    const distFromPlayer = Math.round(Math.hypot(playerX - city.centerX, playerZ - city.centerZ));

    return {
      ...city,
      buildingCount: localBuildings.length,
      storeCount: cityStores.length,
      stores: cityStores,
      landmarks: sortedLandmarks.slice(0, 6).map((b) => ({
        id: b.id,
        name: b.name,
        x: b.x,
        z: b.z,
      })),
      distFromPlayer,
    };
  });
}

export const SHOP_CARS = Object.freeze([
  {
    id: "roadster",
    name: "Sunburst Roadster",
    tagline: "Nimble island convertible with balanced handling",
    primaryColor: "#df5246",
    accentColor: "#f6c944",
    topSpeedKmh: 94,
    accel: 24,
    handling: 2.95,
    nitroPower: 1.38,
    price: 0,
  },
  {
    id: "buggy",
    name: "Rally Buggy 4x4",
    tagline: "All-terrain suspension cuts fast across meadow shortcuts",
    primaryColor: "#2f9e73",
    accentColor: "#f5b82e",
    topSpeedKmh: 102,
    accel: 27,
    handling: 3.15,
    nitroPower: 1.42,
    grassPenalty: 0.92,
    price: 110,
  },
  {
    id: "apex",
    name: "Apex GT Prototype",
    tagline: "Twin-spoiler aero racer built for sub-minute circuit laps",
    primaryColor: "#2d68c4",
    accentColor: "#ffffff",
    topSpeedKmh: 118,
    accel: 30,
    handling: 3.05,
    nitroPower: 1.5,
    grassPenalty: 0.72,
    price: 195,
  },
]);

export function getCarSpec(carId) {
  return SHOP_CARS.find((c) => c.id === carId) || SHOP_CARS[0];
}

export const SHOP_STORES = Object.freeze([
  {
    id: "breezeway_motors",
    name: "Breezeway Garage & Skate",
    creationMatch: /bicycle|skate|garage|motors/i,
    cityId: "westmeadow_harbor",
    cityName: "Westmeadow Harbor",
    specialty: "Race Cars & Speed Tuning",
  },
  {
    id: "clockwork_outfitters",
    name: "Clockwork & Hatters",
    creationMatch: /toyshop|clockwork|tailor|haberdashery/i,
    cityId: "central_square",
    cityName: "Central Town Square",
    specialty: "Vanguard Hats, Wings & Suits",
  },
  {
    id: "matcha_books_wear",
    name: "Matcha Corner Studio",
    creationMatch: /matcha|bookshop|music shop|gallery/i,
    cityId: "central_square",
    cityName: "Central Town Square",
    specialty: "Berets, Shades & Streetwear",
  },
  {
    id: "bakery_treats",
    name: "Windmill & Gelato Market",
    creationMatch: /bakery|windmill|gelateria|candy|pizza|ramen|westmeadow|culinary|cafe/i,
    cityId: "central_square",
    cityName: "Central Town Square",
    specialty: "Espresso Sprint & Island Snacks",
  },
]);

export const SHOP_ITEMS = Object.freeze([
  // Race Cars & Performance Tuning (Breezeway Garage & Skate)
  {
    id: "car-rally-buggy",
    storeId: "breezeway_motors",
    name: "Rally Buggy 4x4",
    desc: "Unlocks the emerald Rally Buggy for the Island Grand Prix. Holds 92% speed off-road.",
    price: 110,
    kind: "car_unlock",
    carId: "buggy",
    tag: "Race Car",
  },
  {
    id: "car-apex-gt",
    storeId: "breezeway_motors",
    name: "Apex GT Prototype",
    desc: "Unlocks our 118 km/h twin-spoiler GT track car with boosted nitro burst.",
    price: 195,
    kind: "car_unlock",
    carId: "apex",
    tag: "Race Car",
  },
  {
    id: "upg-turbo-nitro",
    storeId: "breezeway_motors",
    name: "Twin Nitro Compressor",
    desc: "Permanent +14% nitro surge & faster recharge in every Grand Prix race.",
    price: 85,
    kind: "race_upgrade",
    upgradeKey: "nitroLevel",
    tag: "Tune +1",
  },
  {
    id: "upg-sport-slicks",
    storeId: "breezeway_motors",
    name: "Sport Slick Tires",
    desc: "Permanent +8 km/h top speed and sharper corner grip around circuit hairpins.",
    price: 75,
    kind: "race_upgrade",
    upgradeKey: "topSpeedLevel",
    tag: "Tune +1",
  },

  // Wearable 3D Avatar Gear (Clockwork & Hatters)
  {
    id: "gear-jetpack",
    storeId: "clockwork_outfitters",
    name: "Starhopper Jetpack",
    desc: "Equips a 3D rocket pack onto your avatar's back (synced live in multiplayer).",
    price: 95,
    kind: "avatar",
    slot: "accessory",
    appearancePatch: { accessory: "jetpack", accessoryColor: "#df5246" },
    tag: "3D Gear",
  },
  {
    id: "gear-wings",
    storeId: "clockwork_outfitters",
    name: "Cloudglide Wings",
    desc: "Equips crisp white voxel wings onto your character.",
    price: 90,
    kind: "avatar",
    slot: "accessory",
    appearancePatch: { accessory: "wings", accessoryColor: "#fcfaf5" },
    tag: "3D Gear",
  },
  {
    id: "gear-crown",
    storeId: "clockwork_outfitters",
    name: "Grand Prix Crown",
    desc: "Golden voxel crown for island champions.",
    price: 120,
    kind: "avatar",
    slot: "hat",
    appearancePatch: { hatStyle: "crown", hatColor: "#f5b82e" },
    tag: "3D Hat",
  },
  {
    id: "gear-wizard",
    storeId: "clockwork_outfitters",
    name: "Starry Wizard Hat",
    desc: "Tall cobalt wizard hat for exploring town rooftops.",
    price: 65,
    kind: "avatar",
    slot: "hat",
    appearancePatch: { hatStyle: "wizard", hatColor: "#7a56b8" },
    tag: "3D Hat",
  },

  // Streetwear & Instruments (Matcha Corner Studio)
  {
    id: "gear-shades",
    storeId: "matcha_books_wear",
    name: "Circuit Aviator Shades",
    desc: "Classic dark voxel sunglasses for sunny boardwalk cruises.",
    price: 45,
    kind: "avatar",
    slot: "face",
    appearancePatch: { eyeStyle: "shades" },
    tag: "Eyewear",
  },
  {
    id: "gear-headphones",
    storeId: "matcha_books_wear",
    name: "Studio Headphones",
    desc: "Teal over-ear headphones worn on your 3D avatar.",
    price: 55,
    kind: "avatar",
    slot: "hat",
    appearancePatch: { hatStyle: "headphones", hatColor: "#47b0a3" },
    tag: "3D Hat",
  },
  {
    id: "gear-guitar",
    storeId: "matcha_books_wear",
    name: "Acoustic Travel Guitar",
    desc: "Straps an amber guitar onto your avatar's back.",
    price: 70,
    kind: "avatar",
    slot: "accessory",
    appearancePatch: { accessory: "guitar", accessoryColor: "#d9773b" },
    tag: "3D Gear",
  },
  {
    id: "gear-beret",
    storeId: "matcha_books_wear",
    name: "Painter's Beret & Suit",
    desc: "Equips a crimson beret and tailored downtown suit.",
    price: 80,
    kind: "avatar",
    slot: "hat",
    appearancePatch: { hatStyle: "beret", hatColor: "#df5246", topStyle: "suit", topColor: "#2d323b" },
    tag: "3D Outfit",
  },

  // Consumables & Walk Speed Boosts (Windmill & Gelato Market)
  {
    id: "boost-matcha-espresso",
    storeId: "bakery_treats",
    name: "Matcha Turbo Espresso",
    desc: "Boosts on-foot walking sprint speed by +38% for 90 seconds immediately.",
    price: 25,
    kind: "walk_boost",
    durationMs: 90_000,
    tag: "Walk +38%",
  },
  {
    id: "snack-sourdough",
    storeId: "bakery_treats",
    name: "Warm Sourdough Loaf",
    desc: "Pack in your satchel; consume anytime for a 75s +38% walking speed burst.",
    price: 30,
    kind: "consumable",
    effect: "walk_boost",
    durationMs: 75_000,
    tag: "Satchel",
  },
  {
    id: "snack-gelato",
    storeId: "bakery_treats",
    name: "Pistachio Gelato Cone",
    desc: "Cool island treat stored in your satchel for quick on-foot energy.",
    price: 20,
    kind: "consumable",
    effect: "walk_boost",
    durationMs: 60_000,
    tag: "Satchel",
  },
]);

export function findMatchingStoreForCreation(creation) {
  const name = creation?.name || "";
  if (!name) return null;
  for (const store of SHOP_STORES) {
    if (store.creationMatch.test(name)) {
      return store;
    }
  }
  if (/shop|market|store|bazar|bazaar|cafe|diner|mart|tavern|pizzeria/i.test(name)) {
    return SHOP_STORES[3];
  }
  return null;
}

export function getItemsForStore(storeId) {
  if (!storeId || storeId === "all") return [...SHOP_ITEMS];
  return SHOP_ITEMS.filter((it) => it.storeId === storeId);
}

import { createMeadowWorldEngine } from "./voxel/meadow_engine.js";
import { createCharacterBuilderController } from "./character_builder.js";
import { createMultiplayerClient } from "./multiplayer_client.js";
import { createDeliveryMissionController } from "./mission_system.js";
import { createVoiceNarrator } from "./voice_narrator.js";
import { createSoundEngine } from "./sound_engine.js";
import { createBackgroundMusicEngine } from "./music_engine.js";
import {
  computeSpatialAudioMix,
  createPlayerVoiceChatController,
  loadSavedPlayerVoice,
  savePlayerVoice,
} from "./voice_chat.js";
import {
  computeRoute,
  hitTestFullMap,
  renderFullMapCanvas,
  renderMinimapCanvas,
} from "./island_map.js";
import { saveAppearance, sanitizeAppearance } from "./voxel/character_system.js";
import {
  addCredits,
  buyShopItem,
  equipShopItem,
  getEconomyState,
  recordRaceOutcome,
  selectCar,
  subscribeEconomy,
  tryPondWish,
  useConsumable,
} from "./player_economy.js";
import {
  RACE_PADDOCK_POS,
  SHOP_CARS,
  SHOP_ITEMS,
  SHOP_STORES,
  buildCitiesWithWorldData,
  getCarSpec,
  getDistrictAt,
  getItemsForStore,
} from "./world_catalog.js";

const urlParams = new URLSearchParams(location.search);
const isOgCapture = urlParams.get("og") === "1";
if (isOgCapture) {
  document.body.dataset.ogCapture = "1";
}

const worldCanvas = document.getElementById("world-canvas");

const addBtn = document.getElementById("add-btn");
const pickSpotPill = document.getElementById("pick-spot-pill");
const cancelPickBtn = document.getElementById("cancel-pick-btn");

const bottomBuilder = document.getElementById("bottom-builder");
const moveSpotBtn = document.getElementById("move-spot-btn");
const closeBuilderBtn = document.getElementById("close-builder-btn");

const dropZone = document.getElementById("drop-zone");
const imageInput = document.getElementById("image-input");
const dropEmpty = document.getElementById("drop-empty");
const dropPreviewWrap = document.getElementById("drop-preview-wrap");
const dropPreviewImg = document.getElementById("drop-preview-img");
const clearImageBtn = document.getElementById("clear-image-btn");
const promptInput = document.getElementById("prompt-input");
const sculptBtn = document.getElementById("sculpt-btn");
const formError = document.getElementById("form-error");

const buildingPill = document.getElementById("building-pill");
const buildingPillLabel = document.getElementById("building-pill-label");
const buildingPillSub = document.getElementById("building-pill-sub");
const readyGotoBtn = document.getElementById("ready-goto-btn");
const readyGotoLabel = document.getElementById("ready-goto-label");
const locateMineBtn = document.getElementById("locate-mine-btn");
const locateMineLabel = document.getElementById("locate-mine-label");

const hoverCard = document.getElementById("hover-card");
const hoverName = document.getElementById("hover-name");
const hoverFeed = document.getElementById("hover-feed");
const hoverStatus = document.getElementById("hover-status");
const weaveToast = document.getElementById("weave-toast");

const camPanBtn = document.getElementById("cam-pan-btn");
const camOrbitBtn = document.getElementById("cam-orbit-btn");
const camWalkBtn = document.getElementById("cam-walk-btn");
const recenterBtn = document.getElementById("recenter-btn");
const recenterCompass = document.getElementById("recenter-compass");
const avatarBtn = document.getElementById("avatar-btn");
const avatarSwatchDot = document.getElementById("avatar-swatch-dot");
const soundToggleBtn = document.getElementById("sound-toggle-btn");
const soundToggleLabel = document.getElementById("sound-toggle-label");
const pttMicBtn = document.getElementById("ptt-mic-btn");
const pttMicLabel = document.getElementById("ptt-mic-label");
const musicToggleBtn = document.getElementById("music-toggle-btn");
const musicToggleLabel = document.getElementById("music-toggle-label");
const musicMenuBtn = document.getElementById("music-menu-btn");
const musicPopover = document.getElementById("music-popover");
const musicThemeLabel = document.getElementById("music-theme-label");
const musicStationSelect = document.getElementById("music-station-select");
const musicVolumeRange = document.getElementById("music-volume-range");
const onlinePill = document.getElementById("online-pill");
const onlineCountEl = document.getElementById("online-count");
const interactPromptBtn = document.getElementById("interact-prompt");
const interactKeyEl = document.getElementById("interact-key");
const interactLabelEl = document.getElementById("interact-label");
const interactSecondaryPromptBtn = document.getElementById("interact-secondary-prompt");
const interactSecondaryKeyEl = document.getElementById("interact-secondary-key");
const interactSecondaryLabelEl = document.getElementById("interact-secondary-label");
const walkEscHintBtn = document.getElementById("walk-esc-hint");
const avatarDialog = document.getElementById("avatar-dialog");

const walkJoystick = document.getElementById("walk-joystick");
const walkJoystickKnob = document.getElementById("walk-joystick-knob");
const walkJoyUp = document.getElementById("walk-joy-up");
const walkJoyDown = document.getElementById("walk-joy-down");
const walkJoyLeft = document.getElementById("walk-joy-left");
const walkJoyRight = document.getElementById("walk-joy-right");

const opsDock = document.getElementById("ops-dock");
const mapToggleBtn = document.getElementById("map-toggle-btn");
const citiesToggleBtn = document.getElementById("cities-toggle-btn");
const citiesTriggerLabel = document.getElementById("cities-trigger-label");
const raceToggleBtn = document.getElementById("race-toggle-btn");
const shopToggleBtn = document.getElementById("shop-toggle-btn");
const walletTriggerCredits = document.getElementById("wallet-trigger-credits");
const missionToggleBtn = document.getElementById("mission-toggle-btn");
const radioToggleBtn = document.getElementById("radio-toggle-btn");
const missionTriggerLabel = document.getElementById("mission-trigger-label");
const radioUnreadCount = document.getElementById("radio-unread-count");
const opsDrawer = document.getElementById("ops-drawer");
const opsTabMap = document.getElementById("ops-tab-map");
const opsTabCities = document.getElementById("ops-tab-cities");
const opsTabRace = document.getElementById("ops-tab-race");
const opsTabShop = document.getElementById("ops-tab-shop");
const opsTabMissions = document.getElementById("ops-tab-missions");
const opsTabRadio = document.getElementById("ops-tab-radio");
const opsTabPlayers = document.getElementById("ops-tab-players");
const opsCloseBtn = document.getElementById("ops-close-btn");

const camViewBtn = document.getElementById("cam-view-btn");
const camViewLabel = document.getElementById("cam-view-label");
const greetBtn = document.getElementById("greet-btn");
const hideHudBtn = document.getElementById("hide-hud-btn");
const unhideHudPill = document.getElementById("unhide-hud-pill");
const featuresBottomBtn = document.getElementById("features-bottom-btn");
const deliveryRideDockBtn = document.getElementById("delivery-ride-dock-btn");
const missionRideBtn = document.getElementById("mission-ride-btn");
const minimapRideBtn = document.getElementById("minimap-ride-btn");
const featuresDrawer = document.getElementById("features-drawer");
const featuresCloseBtn = document.getElementById("features-close-btn");
const speedLevelHud = document.getElementById("speed-level-hud");
const speedValEl = document.getElementById("speed-val");
const speedVehicleNameEl = document.getElementById("speed-vehicle-name");
const speedLevelBadgeEl = document.getElementById("speed-level-badge");
const speedHornBtn = document.getElementById("speed-horn-btn");
const speedDismountBtn = document.getElementById("speed-dismount-btn");
const greetingBar = document.getElementById("greeting-bar");
const greetingCloseBtn = document.getElementById("greeting-close-btn");
const customGreetForm = document.getElementById("custom-greet-form");
const customGreetInput = document.getElementById("custom-greet-input");

const mapPanel = document.getElementById("map-panel");
const fullMapCanvas = document.getElementById("full-map-canvas");
const mapZoomInBtn = document.getElementById("map-zoom-in");
const mapZoomOutBtn = document.getElementById("map-zoom-out");
const mapCenterBtn = document.getElementById("map-center-btn");
const mapFitBtn = document.getElementById("map-fit-btn");
const mapRouteTitle = document.getElementById("map-route-title");
const mapRouteMeta = document.getElementById("map-route-meta");
const mapNextStep = document.getElementById("map-next-step");
const mapSpeakBtn = document.getElementById("map-speak-btn");
const mapWalkBtn = document.getElementById("map-walk-btn");
const mapFlyBtn = document.getElementById("map-fly-btn");
const mapClearPinBtn = document.getElementById("map-clear-pin-btn");
const mapEtaLabel = document.getElementById("map-eta-label");
const mapStepsList = document.getElementById("map-steps-list");

const deliveryMinimap = document.getElementById("delivery-minimap");
const minimapOpenBtn = document.getElementById("minimap-open-btn");
const minimapCanvas = document.getElementById("minimap-canvas");
const minimapDistEl = document.getElementById("minimap-dist");
const minimapTurnEl = document.getElementById("minimap-turn");

const voiceBar = document.getElementById("voice-bar");
const voiceSpeakerBadge = document.getElementById("voice-speaker-badge");
const voiceCaption = document.getElementById("voice-caption");
const voiceReplayBtn = document.getElementById("voice-replay-btn");
const voiceToggleBtn = document.getElementById("voice-toggle-btn");

const citiesPanel = document.getElementById("cities-panel");
const currentCityName = document.getElementById("current-city-name");
const currentCitySub = document.getElementById("current-city-sub");
const poiBankBtn = document.getElementById("poi-bank-btn");
const poiCourtBtn = document.getElementById("poi-court-btn");
const citiesList = document.getElementById("cities-list");

const racePanel = document.getElementById("race-panel");
const racePbLap = document.getElementById("race-pb-lap");
const startRaceBtn = document.getElementById("start-race-btn");
const gotoPaddockBtn = document.getElementById("goto-paddock-btn");
const raceTuneSummary = document.getElementById("race-tune-summary");
const raceCarList = document.getElementById("race-car-list");
const refreshRaceBoardBtn = document.getElementById("refresh-race-board-btn");
const raceLeaderboardList = document.getElementById("race-leaderboard-list");

const shopPanel = document.getElementById("shop-panel");
const shopWalletCredits = document.getElementById("shop-wallet-credits");
const shopBoostStatus = document.getElementById("shop-boost-status");
const robStoreBtn = document.getElementById("rob-store-btn");
const shopStoreFilters = document.getElementById("shop-store-filters");
const shopSatchelBox = document.getElementById("shop-satchel-box");
const shopItemsList = document.getElementById("shop-items-list");

const npcDialogCard = document.getElementById("npc-dialog-card");
const npcDialogName = document.getElementById("npc-dialog-name");
const npcDialogMeta = document.getElementById("npc-dialog-meta");
const npcDialogBody = document.getElementById("npc-dialog-body");
const npcDialogActions = document.getElementById("npc-dialog-actions");
const npcDialogClose = document.getElementById("npc-dialog-close");

const raceHud = document.getElementById("race-hud");
const raceHudPlace = document.getElementById("race-hud-place");
const raceHudLap = document.getElementById("race-hud-lap");
const raceHudGates = document.getElementById("race-hud-gates");
const raceHudTime = document.getElementById("race-hud-time");
const raceHudSpeed = document.getElementById("race-hud-speed");
const raceHudNitroFill = document.getElementById("race-hud-nitro-fill");
const raceCamBtn = document.getElementById("race-cam-btn");
const raceRespawnBtn = document.getElementById("race-respawn-btn");
const raceExitBtn = document.getElementById("race-exit-btn");
const raceCountdown = document.getElementById("race-countdown");
const raceTouchControls = document.getElementById("race-touch-controls");
const raceTouchLeft = document.getElementById("race-touch-left");
const raceTouchRight = document.getElementById("race-touch-right");
const raceTouchBrake = document.getElementById("race-touch-brake");
const raceTouchNitro = document.getElementById("race-touch-nitro");
const raceTouchGas = document.getElementById("race-touch-gas");

const missionsPanel = document.getElementById("missions-panel");
const radioPanel = document.getElementById("radio-panel");
const statDeliveries = document.getElementById("stat-deliveries");
const statCredits = document.getElementById("stat-credits");
const statStreak = document.getElementById("stat-streak");
const activeMissionBox = document.getElementById("active-mission-box");
const activeMissionTitle = document.getElementById("active-mission-title");
const activeMissionCargo = document.getElementById("active-mission-cargo");
const activeMissionUrgency = document.getElementById("active-mission-urgency");
const activeMissionTimer = document.getElementById("active-mission-timer");
const stepPickupEl = document.getElementById("step-pickup");
const stepPickupName = document.getElementById("step-pickup-name");
const stepDropoffEl = document.getElementById("step-dropoff");
const stepDropoffName = document.getElementById("step-dropoff-name");
const missionCompassArrow = document.getElementById("mission-compass-arrow");
const activeMissionDist = document.getElementById("active-mission-dist");
const activeMissionRangeNote = document.getElementById("active-mission-range-note");
const missionPrimaryBtn = document.getElementById("mission-primary-btn");
const missionMapBtn = document.getElementById("mission-map-btn");
const missionWalkBtn = document.getElementById("mission-walk-btn");
const missionCancelBtn = document.getElementById("mission-cancel-btn");
const refreshMissionsBtn = document.getElementById("refresh-missions-btn");
const missionList = document.getElementById("mission-list");
const askDispatchMissionBtn = document.getElementById("ask-dispatch-mission-btn");

const radioAiCheckbox = document.getElementById("radio-ai-checkbox");
const radioStatusLine = document.getElementById("radio-status-line");
const radioFeed = document.getElementById("radio-feed");
const radioForm = document.getElementById("radio-form");
const radioInput = document.getElementById("radio-input");
const radioSendBtn = document.getElementById("radio-send-btn");
const radioQuickBtns = Array.from(document.querySelectorAll(".radio-quick-btn"));

const playersPanel = document.getElementById("players-panel");
const mpConnBadge = document.getElementById("mp-conn-badge");
const mpOnlineSummary = document.getElementById("mp-online-summary");
const mpCopyInviteBtn = document.getElementById("mp-copy-invite-btn");
const mpNameForm = document.getElementById("mp-name-form");
const mpNameInput = document.getElementById("mp-name-input");
const mpEmoteWaveBtn = document.getElementById("mp-emote-wave");
const mpEmoteJumpBtn = document.getElementById("mp-emote-jump");
const mpEmoteCheerBtn = document.getElementById("mp-emote-cheer");
const mpMicOpenBtn = document.getElementById("mp-mic-open-btn");
const mpMicPttBtn = document.getElementById("mp-mic-ptt-btn");
const mpMicMeterFill = document.getElementById("mp-mic-meter-fill");
const mpVoiceSelect = document.getElementById("mp-voice-select");
const mpVoiceTestBtn = document.getElementById("mp-voice-test-btn");
const mpVoiceChatCheckbox = document.getElementById("mp-voice-chat-checkbox");
const mpTransportPill = document.getElementById("mp-transport-pill");
const mpPeersList = document.getElementById("mp-peers-list");
const mpChatForm = document.getElementById("mp-chat-form");
const mpChatInput = document.getElementById("mp-chat-input");

const weatherWantedBar = document.getElementById("weather-wanted-bar");
const weatherBadge = document.getElementById("weather-badge");
const weatherCycleBtn = document.getElementById("weather-cycle-btn");
const weatherRandomBtn = document.getElementById("weather-random-btn");
const wantedBadge = document.getElementById("wanted-badge");

const heistCard = document.getElementById("heist-card");
const heistTitle = document.getElementById("heist-title");
const heistBarFill = document.getElementById("heist-bar-fill");
const heistCancelBtn = document.getElementById("heist-cancel-btn");

const policeStopCard = document.getElementById("police-stop-card");
const policeStopUnit = document.getElementById("police-stop-unit");
const policeStopReason = document.getElementById("police-stop-reason");
const policeStopStats = document.getElementById("police-stop-stats");
const stopComplyBtn = document.getElementById("stop-comply-btn");
const stopBluffBtn = document.getElementById("stop-bluff-btn");
const stopFleeBtn = document.getElementById("stop-flee-btn");

const bballHud = document.getElementById("bball-hud");
const bballCloseBtn = document.getElementById("bball-close-btn");
const bballWeatherNote = document.getElementById("bball-weather-note");
const bballSweetZone = document.getElementById("bball-sweet-zone");
const bballCursor = document.getElementById("bball-cursor");
const bballScoreLine = document.getElementById("bball-score-line");
const bballShootBtn = document.getElementById("bball-shoot-btn");
const bballSpotBtns = Array.from(document.querySelectorAll(".bball-spot-btn"));

if (isOgCapture) {
  if (opsDock) opsDock.hidden = true;
  if (deliveryMinimap) deliveryMinimap.hidden = true;
  if (voiceBar) voiceBar.hidden = true;
  if (weatherWantedBar) weatherWantedBar.hidden = true;
  if (heistCard) heistCard.hidden = true;
  if (policeStopCard) policeStopCard.hidden = true;
  if (bballHud) bballHud.hidden = true;
}

// UI states: "idle" | "picking" | "composing" | "building" | "ready" | "placed"
let uiState = "idle";
let myCreationId = null;
let readyCreation = null;
let worldData = null;
let selectedImageDataUrl = null;
let chosenSpot = null;
let toastTimer = null;

// Live multi-user build queue state
let activeJob = null;
let jobPollInterval = null;
let jobPollInFlight = false;

const VISITOR_STORAGE_KEY = "geminisland_visitor_token_v1";
let cachedVisitorToken = (() => {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(VISITOR_STORAGE_KEY) : null;
  } catch {
    return null;
  }
})();

const CLIENT_TIMEZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
})();

function storeVisitorToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return;
  cachedVisitorToken = token;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(VISITOR_STORAGE_KEY, token);
    }
  } catch {
    // Sandboxed iframes without storage access fall back to in-memory cachedVisitorToken
  }
}

function buildVisitorHeaders(extra = {}) {
  const headers = { ...extra };
  if (cachedVisitorToken) {
    headers["x-meadow-visitor"] = cachedVisitorToken;
  }
  if (CLIENT_TIMEZONE) {
    headers["x-meadow-tz"] = CLIENT_TIMEZONE;
  }
  return headers;
}
window.__geminIslandVisitorHeaders = buildVisitorHeaders;

function showToast(text, durationMs = 4200) {
  if (!text || isOgCapture) return;
  weaveToast.textContent = text;
  weaveToast.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    weaveToast.hidden = true;
  }, durationMs);
}

function renderActiveJobLabel() {
  if (buildingPillSub) {
    buildingPillSub.textContent = "Being built with Gemini 4 Hydrogen";
  }
  if (!activeJob) {
    buildingPillLabel.textContent = "Approving query…";
    return;
  }
  if (activeJob.status === "queued" && activeJob.position >= 1) {
    buildingPillLabel.textContent =
      activeJob.position === 1 ? "Next in queue…" : `Waiting in queue (#${activeJob.position})…`;
  } else if (activeJob.phase === "approving") {
    buildingPillLabel.textContent = "Approving query…";
  } else if (activeJob.phase === "reviewing") {
    buildingPillLabel.textContent = "Reviewing 3D model…";
  } else if (activeJob.phase === "refining") {
    buildingPillLabel.textContent = "Polishing details…";
  } else if (activeJob.phase === "placing") {
    buildingPillLabel.textContent = "Placing on island…";
  } else {
    buildingPillLabel.textContent = "Sculpting voxels…";
  }
}

function stopJobTracking() {
  activeJob = null;
  if (jobPollInterval) {
    clearInterval(jobPollInterval);
    jobPollInterval = null;
  }
}

let engine = null;
let characterBuilder = null;
let mpClient = null;
let missionSystem = null;
let activeInteractionPrompt = null;
let lastAvatarDialogCloseMs = -1000;
let currentCamMode = "pan";
let sawTouchInput = false;
let joyPointerId = null;

let opsDrawerOpen = false;
let opsActiveTab = "missions";
let unreadRadioCount = 0;
let radioMessages = [];
let aiDispatchInFlight = false;
let missionTickTimer = null;
let lastRenderedBoardKey = "";

let activeShopStore = "all";
let raceLeaderboard = [];
let raceLeaderboardLoaded = false;
let raceFinishedHandled = false;
let lastDistrictId = "central_square";
let walkBoostTimer = null;
let npcDialogTimer = null;

// Navigation Map, World Sound & Player Voice state
let voiceNarrator = null;
let soundEngine = null;
let musicEngine = null;
let voiceChatCtrl = null;
let localPlayerVoice = loadSavedPlayerVoice();
let lastRaceCountdownInt = -1;
let lastRaceActive = false;
let lastHeistProgressBucket = -1;
let customMapTarget = null;
let mapView = { zoom: 1.05, panX: 0, panZ: 0 };
let mapHoverHit = null;
let currentRoute = null;
let lastSpokenMissionSignature = "";
let announcedApproachLeg = "";
let lastMapStepsKey = "";

// Multiplayer Peers, Dynamic Weather, Heists & Basketball HUD state
const mpPeers = new Map();
let mpOnlineCount = 1;
let mpConnected = false;
let lastWeatherMode = "clear";
let lastBballShotAt = 0;
let bballSpotIdx = 0;
let bballCursor01 = 0.5;
let bballDir = 1;
let bballRafId = null;
let bballLastTs = 0;

function formatClockSec(sec) {
  const s = Math.max(0, Math.trunc(Number(sec) || 0));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

function formatRaceMs(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) {
    return "--:--.-";
  }
  const totalTenths = Math.floor(ms / 100);
  const tenths = totalTenths % 10;
  const totalSec = Math.floor(totalTenths / 10);
  const secs = totalSec % 60;
  const mins = Math.floor(totalSec / 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}

function formatOrdinalPlace(place, total = 4) {
  const p = Math.max(1, Math.min(4, Math.round(Number(place) || 1)));
  const suffix = p === 1 ? "st" : p === 2 ? "nd" : p === 3 ? "rd" : "th";
  return `${p}${suffix} / ${total}`;
}

function formatRadioTime(ts) {
  try {
    const d = new Date(Number(ts) || Date.now());
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function isEditableElementFocused(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function syncAvatarSwatchDot(app) {
  if (!avatarSwatchDot || !app || typeof app !== "object") return;
  const swatchColor =
    (typeof app.topColor === "string" && app.topColor) ||
    (typeof app.hatColor === "string" && app.hatColor) ||
    "#4c82d4";
  avatarSwatchDot.style.backgroundColor = swatchColor;
}

function updateOnlinePill(count) {
  const validCount =
    typeof count === "number" && Number.isFinite(count) && count >= 1 ? Math.trunc(count) : null;
  if (validCount !== null) {
    mpOnlineCount = validCount;
  }
  if (radioStatusLine) {
    const onlineText = validCount !== null ? `Ch. 04 · ${validCount} online` : "Ch. 04 · Live";
    radioStatusLine.textContent = onlineText;
  }
  syncMpStatusSummary();
  if (!onlinePill) return;
  if (isOgCapture || validCount === null) {
    onlinePill.hidden = true;
    return;
  }
  if (onlineCountEl) {
    onlineCountEl.textContent = String(validCount);
  }
  onlinePill.hidden = false;
}

function syncMpStatusSummary() {
  const transport = mpClient?.getTransport?.() || "connecting";
  if (mpConnBadge) {
    mpConnBadge.textContent =
      mpConnected || mpClient?.isConnected?.()
        ? transport === "http"
          ? "Live Multiplayer · Relay Sync"
          : "Live Multiplayer · Connected"
        : "Live Multiplayer · Connecting";
  }
  if (mpOnlineSummary) {
    mpOnlineSummary.textContent =
      mpOnlineCount === 1 ? "1 explorer online (you)" : `${mpOnlineCount} explorers online`;
  }
  if (mpTransportPill) {
    mpTransportPill.textContent =
      transport === "ws" ? "WebSocket" : transport === "http" ? "Live Relay" : "Connecting";
  }
}

function renderPlayersPanel() {
  if (!mpPeersList || isOgCapture) return;
  syncMpStatusSummary();

  const localApp = engine?.getLocalAppearance?.();
  if (mpNameInput && document.activeElement !== mpNameInput && typeof localApp?.name === "string") {
    mpNameInput.value = localApp.name;
  }

  mpPeersList.replaceChildren();
  const peers = Array.from(mpPeers.values());
  if (peers.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mp-empty-state";
    empty.textContent =
      "No other explorers connected yet — share the invite link to explore, race, or play basketball together live!";
    mpPeersList.appendChild(empty);
    return;
  }

  for (const peer of peers) {
    const card = document.createElement("div");
    card.className = "mp-peer-card";
    if (peer.speaking) card.classList.add("is-speaking");

    const main = document.createElement("div");
    main.className = "mp-peer-main";

    const swatch = document.createElement("span");
    swatch.className = "mp-peer-swatch";
    swatch.style.backgroundColor = peer.appearance?.topColor || "#7c3aed";

    const info = document.createElement("div");
    const nameEl = document.createElement("div");
    nameEl.className = "mp-peer-name";
    nameEl.textContent = peer.name || "Explorer";

    const vBadge = document.createElement("span");
    vBadge.className = "mp-peer-voice-badge";
    vBadge.textContent = peer.speaking
      ? "Speaking"
      : peer.micActive
        ? "Mic Live"
        : peer.voice || "Puck";
    nameEl.appendChild(vBadge);

    const dist =
      Number.isFinite(peer.x) && Number.isFinite(peer.z) && engine
        ? (() => {
            const pos = engine.getPlayerPosition();
            return Math.round(Math.hypot(peer.x - pos.x, peer.z - pos.z));
          })()
        : null;
    const city =
      Number.isFinite(peer.x) && Number.isFinite(peer.z) ? getDistrictAt(peer.x, peer.z) : null;
    const metaEl = document.createElement("div");
    metaEl.className = "mp-peer-meta";
    metaEl.textContent = `${city?.badge || "Island"}${dist !== null ? ` · ${dist} m` : ""}`;

    info.appendChild(nameEl);
    info.appendChild(metaEl);
    main.appendChild(swatch);
    main.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "mp-peer-actions";

    const walkBtn = document.createElement("button");
    walkBtn.type = "button";
    walkBtn.className = "ops-btn ops-btn-primary";
    walkBtn.textContent = "Walk To";
    walkBtn.addEventListener("click", () => {
      if (!Number.isFinite(peer.x) || !Number.isFinite(peer.z)) return;
      closeOpsDrawer();
      engine?.teleportTo?.(peer.x - 2.4, peer.z + 2.4, { enterWalk: true });
      showToast(`Teleported near ${peer.name || "Explorer"}`, 2800);
    });

    const locBtn = document.createElement("button");
    locBtn.type = "button";
    locBtn.className = "ops-btn ops-btn-secondary";
    locBtn.textContent = "Locate";
    locBtn.addEventListener("click", () => {
      if (!Number.isFinite(peer.x) || !Number.isFinite(peer.z)) return;
      closeOpsDrawer();
      engine?.focusOn?.(peer.x, peer.z, 1.65);
    });

    const waveBtn = document.createElement("button");
    waveBtn.type = "button";
    waveBtn.className = "ops-btn ops-btn-secondary";
    waveBtn.textContent = "Wave";
    waveBtn.addEventListener("click", () => {
      engine?.triggerLocalWave?.();
      mpClient?.sendEmote?.("wave");
      showToast(`Waved at ${peer.name || "Explorer"}!`, 2200);
    });

    actions.appendChild(walkBtn);
    actions.appendChild(locBtn);
    actions.appendChild(waveBtn);
    card.appendChild(main);
    card.appendChild(actions);
    mpPeersList.appendChild(card);
  }
}

function upsertMpPeerRecord(raw) {
  if (!raw || typeof raw.id !== "string") return;
  const selfId = mpClient?.getSelfId?.();
  if (selfId && raw.id === selfId) return;
  const prev = mpPeers.get(raw.id) || {};
  mpPeers.set(raw.id, {
    ...prev,
    ...raw,
    name:
      typeof raw.name === "string" && raw.name.trim()
        ? raw.name.trim()
        : prev.name || raw.appearance?.name || "Explorer",
    appearance: raw.appearance ? { ...(prev.appearance || {}), ...raw.appearance } : prev.appearance,
  });
}

function syncWeatherBarUI(wState) {
  if (!wState || isOgCapture) return;
  const mode = wState.mode || "clear";
  if (weatherBadge) {
    weatherBadge.classList.remove("is-rain", "is-snow");
    if (mode === "rain") {
      weatherBadge.classList.add("is-rain");
      weatherBadge.textContent =
        wState.slowPct > 0
          ? `Rain (-${wState.slowPct}% spd · ${wState.eventRemainingSec}s)`
          : "Rain Shower";
    } else if (mode === "snow") {
      weatherBadge.classList.add("is-snow");
      weatherBadge.textContent =
        wState.slowPct > 0
          ? `Snowfall (-${wState.slowPct}% spd · ${wState.eventRemainingSec}s)`
          : "Snowfall";
    } else {
      weatherBadge.textContent = "Sunlit · Clear";
    }
  }
  if (weatherCycleBtn) {
    weatherCycleBtn.textContent = mode === "clear" ? "Clear" : mode === "rain" ? "Rain" : "Snow";
  }

  if (mode !== lastWeatherMode) {
    lastWeatherMode = mode;
    if (mode === "rain") {
      showToast("Sudden rainstorm! Island turf is slick — movement slowed 22%.", 4200);
      if (voiceNarrator?.getState?.().enabled) {
        void voiceNarrator.speak(
          "Weather alert: Rainstorm passing over GeminIsland. Roads are slick and walking speed is reduced.",
          { persona: "dispatch", speakerLabel: "Weather Alert" },
        );
      }
    } else if (mode === "snow") {
      showToast("Sudden snowfall! Drifts cover the island — movement slowed 34%.", 4200);
      if (voiceNarrator?.getState?.().enabled) {
        void voiceNarrator.speak(
          "Weather alert: Snowfall blanketing GeminIsland. Watch for crosswinds on the basketball court.",
          { persona: "dispatch", speakerLabel: "Weather Alert" },
        );
      }
    } else {
      showToast("Skies cleared — sunlit meadow pace restored!", 3000);
    }
  }

  if (bballHud && !bballHud.hidden) {
    renderBballWeatherHint(wState);
  }
}

function closePoliceStopCard() {
  if (policeStopCard) policeStopCard.hidden = true;
}

function openPoliceStopCard(payload) {
  if (!policeStopCard || isOgCapture || !payload) return;
  soundEngine?.playPoliceStop?.();
  resetWalkJoystick();
  engine?.releaseWalkPointerLock?.();
  if (policeStopUnit) {
    policeStopUnit.textContent = `${payload.unitId || "Unit 04"} · ${payload.officer || "Officer Sunny"}`;
  }
  if (policeStopReason) {
    policeStopReason.textContent = payload.reason || "Patrol Traffic Stop — Pull Over!";
  }
  if (policeStopStats) {
    const stars = payload.wantedStars > 0 ? "★".repeat(payload.wantedStars) : "Clear Record";
    policeStopStats.textContent = `Wanted: ${stars} · Hot Loot: ${payload.hotLoot || 0} cr · Citation Fine: ${payload.fineCredits || 15} cr`;
  }
  policeStopCard.hidden = false;
  if (voiceNarrator?.getState?.().enabled) {
    void voiceNarrator.speak(
      `${payload.unitId || "Unit 04"} here. ${payload.reason || "Please pull over for a patrol check."}`,
      { persona: "dispatch", speakerLabel: payload.officer || "Officer Sunny" },
    );
  }
}

function syncHeistWantedUI(hState) {
  if (!hState || isOgCapture) return;

  if (wantedBadge) {
    if (hState.wantedStars > 0) {
      const stars = "★".repeat(hState.wantedStars);
      wantedBadge.textContent = `Wanted ${stars} · Loot ${hState.hotLoot} cr · ${hState.stashTimerSec}s`;
      wantedBadge.hidden = false;
    } else {
      wantedBadge.hidden = true;
    }
  }

  if (heistCard) {
    if (hState.activeRobbery) {
      if (heistTitle) {
        heistTitle.textContent = `Cracking ${hState.activeRobbery.name}…`;
      }
      if (heistBarFill) {
        const pct = Math.max(0, Math.min(100, Math.round((hState.activeRobbery.progress01 || 0) * 100)));
        heistBarFill.style.width = `${pct}%`;
      }
      heistCard.hidden = false;
    } else {
      heistCard.hidden = true;
    }
  }

  if (hState.event === "robbery_started") {
    soundEngine?.playHeistAlarm?.();
    showToast(`Cracking ${hState.targetName} — stay close!`, 3200);
  } else if (hState.event === "robbery_completed") {
    soundEngine?.playLootSuccess?.();
    const loot = Number(hState.loot) || 0;
    if (loot > 0) addCredits(loot);
    showToast(
      `Heist score! Grabbed +${loot} cr at ${hState.targetName}! Evade police cruisers for 22s!`,
      5200,
    );
    appendRadioMessage({
      id: `heist-${Date.now().toString(36)}`,
      senderKind: "dispatch",
      senderName: "Officer Sunny",
      unitCode: "10-90 · Alert",
      text: `All units respond! Alarm triggered at ${hState.targetName} (${"★".repeat(hState.wantedStars || 1)}). Cruisers intercepting!`,
      ts: Date.now(),
    });
    if (voiceNarrator?.getState?.().enabled) {
      void voiceNarrator.speak(
        `Dispatch alert! Robbery in progress at ${hState.targetName}. Patrol cruisers moving to intercept!`,
        { persona: "dispatch", speakerLabel: "Officer Sunny" },
      );
    }
  } else if (hState.event === "robbery_cancelled") {
    showToast(`Heist aborted: ${hState.reason || "Cancelled"}`, 2800);
  } else if (hState.event === "loot_stashed") {
    soundEngine?.playLootSuccess?.();
    const bonus = Number(hState.escapeBonus) || 20;
    addCredits(bonus);
    showToast(`Pursuit evaded! Loot stashed safely (+${bonus} cr escape bonus)!`, 4600);
    if (voiceNarrator?.getState?.().enabled) {
      void voiceNarrator.speak(
        `Unit 04 lost visual on suspect. Escape bonus ${bonus} credits awarded.`,
        { persona: "dispatch", speakerLabel: "Dispatch" },
      );
    }
  }
}

function getBballSpotPoints(spotIdx) {
  return spotIdx === 0 ? 2 : 3;
}

function renderBballWeatherHint(wState = engine?.getWeatherState?.()) {
  if (!bballHud) return;
  const mode = wState?.mode || "clear";
  const windX = Number(wState?.windX) || 0;
  const pts = getBballSpotPoints(bballSpotIdx);
  const tolerance = mode === "rain" ? 0.14 : pts === 3 ? 0.19 : 0.23;
  const windShift = mode === "snow" ? Math.max(-0.075, Math.min(0.075, windX * 0.025)) : 0;
  const center01 = 0.5 - windShift;
  const leftPct = Math.max(4, Math.min(90, (center01 - tolerance) * 100));
  const widthPct = Math.max(8, Math.min(92 - leftPct, tolerance * 2 * 100));

  if (bballSweetZone) {
    bballSweetZone.style.left = `${leftPct.toFixed(1)}%`;
    bballSweetZone.style.width = `${widthPct.toFixed(1)}%`;
  }
  if (bballWeatherNote) {
    if (mode === "rain") {
      bballWeatherNote.textContent = "Rain slick ball · Tighter green sweet spot";
    } else if (mode === "snow") {
      const dir = windX >= 0 ? "East wind" : "West wind";
      bballWeatherNote.textContent = `Snow ${dir} · Sweet zone shifted`;
    } else {
      bballWeatherNote.textContent = "Calm sunlit court · Standard sweet spot";
    }
  }
}

function stopBballMeter() {
  if (bballRafId !== null) {
    cancelAnimationFrame(bballRafId);
    bballRafId = null;
  }
}

function stepBballMeter(ts) {
  if (!bballHud || bballHud.hidden) {
    bballRafId = null;
    return;
  }
  const dt = bballLastTs ? Math.min(0.05, (ts - bballLastTs) / 1000) : 0.016;
  bballLastTs = ts;
  const wMode = engine?.getWeatherState?.()?.mode || "clear";
  const meterSpd = bballSpotIdx === 0 ? 1.15 : 1.38;
  const weatherJitter = wMode === "snow" ? 0.12 : wMode === "rain" ? 0.08 : 0;
  bballCursor01 += bballDir * (meterSpd + weatherJitter) * dt;
  if (bballCursor01 >= 0.96) {
    bballCursor01 = 0.96;
    bballDir = -1;
  } else if (bballCursor01 <= 0.04) {
    bballCursor01 = 0.04;
    bballDir = 1;
  }
  if (bballCursor) {
    bballCursor.style.left = `${(bballCursor01 * 100).toFixed(1)}%`;
  }
  bballRafId = requestAnimationFrame(stepBballMeter);
}

function openBasketballHud() {
  if (!bballHud || isOgCapture) return;
  resetWalkJoystick();
  engine?.releaseWalkPointerLock?.();
  bballHud.hidden = false;
  const court = engine?.getBasketballState?.();
  if (bballScoreLine && court) {
    bballScoreLine.textContent = `Pts: ${court.totalPoints || 0} · Streak: ${court.streak || 0}`;
  }
  renderBballWeatherHint(engine?.getWeatherState?.());
  stopBballMeter();
  bballLastTs = 0;
  bballRafId = requestAnimationFrame(stepBballMeter);
}

function closeBasketballHud() {
  stopBballMeter();
  if (bballHud) bballHud.hidden = true;
}

function shootBasketballNow() {
  if (!engine || isOgCapture) return;
  const now = performance.now();
  if (now - lastBballShotAt < 320) return;
  lastBballShotAt = now;
  engine.shootBasketball(bballSpotIdx, bballCursor01);
}

function startStoreOrBankRobbery() {
  if (!engine || isOgCapture) return false;
  const pos = engine.getPlayerPosition?.() || { x: 0, z: 0 };
  const bankDist = Math.hypot(26 - pos.x, 22 - pos.z);
  if (bankDist <= 7.2) {
    const res = engine.startRobbery({
      id: "treasury-bank-vault",
      name: "Island Treasury Bank",
      kind: "bank",
      x: 26,
      z: 22,
    });
    if (!res?.ok) {
      showToast(res?.reason || "Cannot crack bank vault right now", 3000);
      return false;
    }
    closeOpsDrawer();
    return true;
  }

  const nearbyShop = engine.findNearbyShopForRobbery?.();
  if (nearbyShop?.store && nearbyShop?.ent) {
    const res = engine.startRobbery({
      id: nearbyShop.store.id,
      name: `${nearbyShop.store.name} Register`,
      kind: "store",
      x: nearbyShop.ent.x,
      z: nearbyShop.ent.z,
    });
    if (!res?.ok) {
      showToast(res?.reason || "Cannot rob register right now", 3000);
      return false;
    }
    closeOpsDrawer();
    return true;
  }

  showToast("Walk close to a Shop or Island Treasury Bank Vault (26, 22) to rob!", 3600);
  return false;
}

function isMobileWalkViewport() {
  if (sawTouchInput) return true;
  if (window.matchMedia?.("(pointer: coarse)")?.matches) return true;
  return window.innerWidth <= 768;
}

function resetWalkJoystick() {
  joyPointerId = null;
  walkJoystick?.classList.remove("is-active");
  walkJoystickKnob?.setAttribute("transform", "translate(0 0)");
  walkJoyUp?.classList.remove("is-lit");
  walkJoyDown?.classList.remove("is-lit");
  walkJoyLeft?.classList.remove("is-lit");
  walkJoyRight?.classList.remove("is-lit");
  engine?.setJoystickInput(0, 0);
}

function syncWalkDesktopDataset() {
  const showDesktopWalk = !isOgCapture && currentCamMode === "walk" && !isMobileWalkViewport();
  if (showDesktopWalk) {
    document.body.dataset.walkDesktop = "1";
  } else {
    delete document.body.dataset.walkDesktop;
  }
}

function syncWalkJoystickVisibility() {
  const show = !isOgCapture && currentCamMode === "walk" && isMobileWalkViewport();
  if (walkJoystick) {
    walkJoystick.hidden = !show;
  }
  if (show) {
    document.body.dataset.walkMobile = "1";
  } else {
    delete document.body.dataset.walkMobile;
    resetWalkJoystick();
  }
  syncWalkDesktopDataset();
}

function syncCameraModeUI(mode) {
  currentCamMode = mode;
  const isPan = mode === "pan";
  const isOrbit = mode === "orbit";
  const isWalk = mode === "walk";
  const isRace = mode === "race";
  if (camPanBtn) {
    camPanBtn.classList.toggle("is-active", isPan);
    camPanBtn.setAttribute("aria-pressed", isPan ? "true" : "false");
  }
  if (camOrbitBtn) {
    camOrbitBtn.classList.toggle("is-active", isOrbit);
    camOrbitBtn.setAttribute("aria-pressed", isOrbit ? "true" : "false");
  }
  if (camWalkBtn) {
    camWalkBtn.classList.toggle("is-active", isWalk);
    camWalkBtn.setAttribute("aria-pressed", isWalk ? "true" : "false");
  }
  if (isRace) {
    document.body.dataset.racing = "1";
  } else {
    delete document.body.dataset.racing;
  }
  syncWalkJoystickVisibility();
  if (walkEscHintBtn) {
    walkEscHintBtn.hidden = isOgCapture || !isWalk || isMobileWalkViewport();
  }
}

const demoClickTimers = new WeakMap();

function triggerCameraButtonClickFX(mode) {
  syncCameraModeUI(mode);
  const btn = mode === "walk" ? camWalkBtn : mode === "orbit" ? camOrbitBtn : camPanBtn;
  if (!btn || isOgCapture) return;
  const prevTimer = demoClickTimers.get(btn);
  if (prevTimer) clearTimeout(prevTimer);
  btn.classList.remove("is-demo-click");
  void btn.offsetWidth;
  btn.classList.add("is-demo-click");
  demoClickTimers.set(
    btn,
    setTimeout(() => {
      btn.classList.remove("is-demo-click");
    }, 740),
  );
}

const lastIncidentSentByVehicle = new Map();

async function reportTrafficIncidentToObserver(incident) {
  if (isOgCapture || !incident || typeof incident.vehicleId !== "string") return;
  const nowMs = Date.now();
  const prevMs = lastIncidentSentByVehicle.get(incident.vehicleId) || 0;
  if (nowMs - prevMs < 25_000) return;
  lastIncidentSentByVehicle.set(incident.vehicleId, nowMs);
  try {
    await fetch("/api/traffic-incident", {
      method: "POST",
      headers: buildVisitorHeaders({
        "content-type": "application/json",
        "x-meadow-client": "1",
      }),
      body: JSON.stringify({
        vehicleId: incident.vehicleId,
        peerVehicleId: incident.peerVehicleId || null,
        x: incident.x,
        z: incident.z,
        reason: incident.reason || "self_restored",
      }),
    });
  } catch {
    // Ignore transient network errors during background telemetry
  }
}

engine = createMeadowWorldEngine(
  worldCanvas,
  {
    onHoverCreation(creation, clientX, clientY, reading) {
      if (
        !creation ||
        uiState === "picking" ||
        isOgCapture ||
        (activeInteractionPrompt && engine?.isFirstPerson?.())
      ) {
        hoverCard.hidden = true;
        return;
      }
      hoverName.textContent = creation.name;
      if (reading?.summary) {
        hoverFeed.textContent = reading.summary;
        hoverFeed.hidden = false;
      } else {
        hoverFeed.hidden = true;
      }
      hoverStatus.textContent = creation.description || creation.behavior?.statusLine || "";
      hoverCard.style.left = `${clientX}px`;
      hoverCard.style.top = `${clientY}px`;
      hoverCard.hidden = false;
    },
    onSelectCreation(creation, reading) {
      if (!creation || isOgCapture) return;
      const baseDesc = creation.description || creation.behavior?.statusLine || "";
      const detail = reading?.summary
        ? baseDesc
          ? `${reading.summary} · ${baseDesc}`
          : reading.summary
        : baseDesc;
      showToast(detail ? `${creation.name} — ${detail}` : creation.name);
    },
    onInteractiveEvent(_creation, message) {
      if (!message || isOgCapture) return;
      if (typeof message === "object" && message.kind === "basketball_shot") {
        soundEngine?.playBasketballShot?.(Boolean(message.made));
        if (bballScoreLine) {
          bballScoreLine.textContent = `Pts: ${message.totalPoints || 0} · Streak: ${message.streak || 0}`;
        }
        if (message.made) {
          const baseCr = message.pts === 3 ? 10 : 6;
          const streakCr = (message.streak || 0) >= 2 ? 4 : 0;
          const totalCr = baseCr + streakCr;
          addCredits(totalCr);
          showToast(`${message.text} (+${totalCr} cr)`, 3400);
          if (voiceNarrator?.getState?.().enabled && ((message.streak || 0) >= 2 || message.pts === 3)) {
            void voiceNarrator.speak(
              message.streak >= 3
                ? `Nothing but net! ${message.streak} in a row on the half-court!`
                : `Downtown swish for 3! Plus ${totalCr} credits.`,
              { persona: "race", speakerLabel: "Court Announcer" },
            );
          }
        } else if (message.text) {
          showToast(message.text, 2600);
        }
        return;
      }
      const txt = typeof message === "string" ? message : message.text;
      if (txt) showToast(txt);
    },
    onToast(msg, ms) {
      showToast(msg, ms);
    },
    onWeatherChange(wState) {
      syncWeatherBarUI(wState);
    },
    onHeistStateChange(hState) {
      syncHeistWantedUI(hState);
    },
    onPoliceStopTrigger(payload) {
      openPoliceStopCard(payload);
    },
    onBasketballCourtOpen() {
      openBasketballHud();
    },
    onBankVaultSelect() {
      showToast("Island Treasury Bank — switch to Walk mode near the vault and press E to rob!", 4200);
    },
    onPickGroundSpot(x, z) {
      chosenSpot = { x, z };
      uiState = "composing";
      syncDockUI();
      if (window.innerWidth > 640) {
        promptInput.focus({ preventScroll: true });
      }
    },
    onAutoNudgeSpot(x, z) {
      if (chosenSpot) {
        chosenSpot = { x, z };
      }
    },
    onDragModeChange(mode) {
      syncCameraModeUI(mode);
    },
    onIntroDemoStep(mode) {
      triggerCameraButtonClickFX(mode);
    },
    onCameraChange(camState) {
      if (recenterCompass && typeof camState?.azDeltaFromHome === "number") {
        const deg = ((camState.azDeltaFromHome * 180) / Math.PI).toFixed(1);
        recenterCompass.setAttribute("transform", `rotate(${deg} 12 12)`);
      }
      if (typeof camState?.tx === "number" && typeof camState?.tz === "number") {
        syncDistrictIndicator(camState.tx, camState.tz);
      }
    },
    onInteractionPromptChange(promptInfo) {
      activeInteractionPrompt = promptInfo || null;
      if (!interactPromptBtn) return;
      if (!promptInfo || isOgCapture) {
        interactPromptBtn.hidden = true;
        return;
      }
      if (interactKeyEl) {
        interactKeyEl.textContent = promptInfo.keyHint || "E";
      }
      if (interactLabelEl) {
        interactLabelEl.textContent = promptInfo.label || "Interact";
      }
      interactPromptBtn.hidden = false;
      if (engine?.isFirstPerson?.()) {
        hoverCard.hidden = true;
      }
    },
    onSecondaryPromptChange(secInfo) {
      if (!interactSecondaryPromptBtn) return;
      if (!secInfo || isOgCapture) {
        interactSecondaryPromptBtn.hidden = true;
        return;
      }
      if (interactSecondaryKeyEl) {
        interactSecondaryKeyEl.textContent = secInfo.keyHint || "F";
      }
      if (interactSecondaryLabelEl) {
        interactSecondaryLabelEl.textContent = secInfo.label || "Shop";
      }
      interactSecondaryPromptBtn.hidden = false;
    },
    onVillagerTalk(dlg) {
      if (!dlg || isOgCapture) return;
      const line = dlg.text || "Sunny day across the meadow!";
      openNpcDialog({
        name: dlg.name || "Neighbor",
        meta: `${dlg.role || "Resident"} · ${dlg.district || "GeminIsland"}`,
        body: line,
        actions: [
          {
            label: "Voice",
            variant: "ops-btn-accent",
            onClick: () => {
              void voiceNarrator?.speak(line, {
                persona: "villager",
                speakerLabel: dlg.name || "Villager",
                force: true,
              });
            },
          },
          {
            label: "Wave Back",
            variant: "ops-btn-secondary",
            onClick: () => {
              engine?.triggerLocalWave?.();
              mpClient?.sendEmote?.("wave");
              closeNpcDialog();
            },
          },
          {
            label: "Nearby Cities",
            variant: "ops-btn-primary",
            onClick: () => {
              closeNpcDialog();
              openOpsDrawer("cities");
            },
          },
        ],
      });
      if (voiceNarrator?.getState?.().enabled) {
        void voiceNarrator.speak(line, {
          persona: "villager",
          speakerLabel: dlg.name || "Villager",
        });
      }
    },
    onDistrictSignInteract(city) {
      if (!city || isOgCapture) return;
      const msg = `${city.name}. ${city.subtitle}. Explore landmarks, talk to local residents, or hop between neighborhoods from the Cities hub.`;
      openNpcDialog({
        name: city.name,
        meta: `${city.badge || "District"} · Island Signpost`,
        body: msg,
        actions: [
          {
            label: "Voice",
            variant: "ops-btn-accent",
            onClick: () => {
              void voiceNarrator?.speak(msg, {
                persona: "gps",
                speakerLabel: city.badge || "Signpost",
                force: true,
              });
            },
          },
          {
            label: "Open Map",
            variant: "ops-btn-primary",
            onClick: () => {
              closeNpcDialog();
              openOpsDrawer("map");
            },
          },
        ],
      });
      if (voiceNarrator?.getState?.().enabled) {
        void voiceNarrator.speak(`${city.name}. ${city.subtitle}.`, {
          persona: "gps",
          speakerLabel: city.badge || "Signpost",
        });
      }
    },
    onRacePaddockInteract() {
      if (isOgCapture) return;
      closeNpcDialog();
      openOpsDrawer("race");
      showToast("Island Grand Prix Paddock — choose your car or press Start Race Now!", 3800);
    },
    onOpenStore(store, creation) {
      if (!store || isOgCapture) return;
      closeNpcDialog();
      activeShopStore = store.id;
      openOpsDrawer("shop");
      const title = creation?.name ? `${store.name} (${creation.name})` : store.name;
      showToast(`Welcome to ${title}!`, 3200);
    },
    onWishPondInteract() {
      if (isOgCapture) return;
      const res = tryPondWish();
      if (res.ok) {
        soundEngine?.playCoinWish?.();
        showToast(`Lucky Coin tossed! +${res.reward} cr added (${res.credits} cr total)`, 4000);
      } else {
        showToast(`Wishing Pond sparkles recharging — wait ${res.remainSec}s`, 2800);
      }
    },
    onRaceTick(raceStatus) {
      renderRaceHud(raceStatus);
    },
    onDeliveryRideTick(rideStatus) {
      renderDeliveryRideHud(rideStatus);
    },
    getActiveMissionContext() {
      return missionSystem?.getPoliceContext?.() || null;
    },
    onLocalEmote(kind) {
      mpClient?.sendEmote(kind);
      soundEngine?.playEmoteVoice?.(kind, {
        pan: 0,
        gain: 0.9,
        voice: localPlayerVoice,
      });
    },
    onPlayerSoundEvent(eventType, meta) {
      if (isOgCapture || !soundEngine) return;
      if (eventType === "step") soundEngine.playFootstep(meta);
      else if (eventType === "jump") soundEngine.playJump(meta);
      else if (eventType === "land") soundEngine.playLand(meta);
      else if (eventType === "horn") soundEngine.playScooterHorn();
      else if (eventType === "greeting") soundEngine.playGreetingPing();
    },
    onInteriorChange(roomInfo) {
      if (roomInfo) {
        document.body.dataset.inInterior = "1";
        if (uiState === "picking" || uiState === "composing") {
          hideError();
          chosenSpot = null;
          uiState = "idle";
          syncDockUI();
        }
      } else {
        delete document.body.dataset.inInterior;
      }
      hoverCard.hidden = true;
      mpClient?.forcePoseSync();
    },
    onTrafficIncident(incident) {
      void reportTrafficIncidentToObserver(incident);
    },
    onDeliveryInteract() {
      missionSystem?.completeCurrentStep?.();
    },
    onDeliveryBeaconSelect(info) {
      if (isOgCapture) return;
      const distText =
        typeof info?.distMeters === "number" ? ` (${Math.round(info.distMeters)} m away)` : "";
      showToast(`Delivery waypoint${distText} — walk nearby or press E in Walk mode`);
    },
  },
  { ogMode: isOgCapture },
);

window.__geminIslandCam = () => engine.getCameraState();
window.__geminIslandEngine = engine;

function updateMissionTelemetryUI(state) {
  if (!state) return;
  const m = state.activeMission;
  const prog = state.liveProgress || {};
  missionToggleBtn?.classList.toggle("is-mission-live", Boolean(m));

  if (!m) {
    if (missionTriggerLabel) missionTriggerLabel.textContent = "Deliveries";
    return;
  }

  const targetStep = m.phase === "to_pickup" ? "Pickup" : "Deliver";
  const dist = typeof prog.distMeters === "number" ? prog.distMeters : null;

  if (missionTriggerLabel) {
    missionTriggerLabel.textContent = prog.inRange
      ? `${targetStep} · Ready (E)`
      : dist !== null
        ? `${targetStep} · ${dist} m`
        : targetStep;
  }
  if (activeMissionTimer) {
    activeMissionTimer.textContent = formatClockSec(prog.remainingBonusSec);
  }
  if (activeMissionDist) {
    activeMissionDist.textContent = dist !== null ? `${dist} m` : "-- m";
  }
  if (missionCompassArrow) {
    const deg = ((prog.relBearingRad || 0) * 180) / Math.PI;
    missionCompassArrow.style.transform = `rotate(${deg.toFixed(1)}deg)`;
  }
  if (activeMissionRangeNote) {
    activeMissionRangeNote.classList.toggle("is-in-range", Boolean(prog.inRange));
    activeMissionRangeNote.textContent = prog.inRange
      ? "Within range — press E or tap below"
      : "Follow beacon";
  }
  if (missionPrimaryBtn) {
    if (prog.inRange) {
      missionPrimaryBtn.textContent =
        m.phase === "to_pickup" ? "Pick Up Parcel" : "Deliver Parcel";
      missionPrimaryBtn.classList.add("ops-btn-accent");
      missionPrimaryBtn.classList.remove("ops-btn-primary");
    } else {
      missionPrimaryBtn.textContent = "Locate Stop";
      missionPrimaryBtn.classList.add("ops-btn-primary");
      missionPrimaryBtn.classList.remove("ops-btn-accent");
    }
  }
}

function stopMissionTickLoop() {
  if (missionTickTimer) {
    clearInterval(missionTickTimer);
    missionTickTimer = null;
  }
}

function ensureMissionTickLoop(hasActive) {
  if (!hasActive) {
    stopMissionTickLoop();
    return;
  }
  if (missionTickTimer) return;
  missionTickTimer = setInterval(() => {
    if (!missionSystem) return;
    missionSystem.updateProgress();
    const st = missionSystem.getState();
    if (!st.activeMission) {
      stopMissionTickLoop();
      return;
    }
    updateMissionTelemetryUI(st);
    maybeAnnounceDeliveryVoice(st, currentRoute);
  }, 180);
}

function renderMissionState(state) {
  if (!state || isOgCapture) return;
  if (statDeliveries) statDeliveries.textContent = String(state.stats?.deliveries ?? 0);
  if (statCredits) statCredits.textContent = String(state.stats?.credits ?? 0);
  if (statStreak) statStreak.textContent = String(state.stats?.streak ?? 0);

  const m = state.activeMission;
  if (activeMissionBox) activeMissionBox.hidden = !m;
  ensureMissionTickLoop(Boolean(m));

  if (m) {
    if (activeMissionTitle) activeMissionTitle.textContent = m.title;
    if (activeMissionCargo) activeMissionCargo.textContent = `Cargo: ${m.cargo}`;
    if (activeMissionUrgency) {
      activeMissionUrgency.textContent =
        m.urgency === "express" ? "Express" : m.urgency === "priority" ? "Priority" : "Standard";
      activeMissionUrgency.dataset.urgency = m.urgency || "standard";
    }
    if (stepPickupName) stepPickupName.textContent = `Pickup: ${m.pickupName}`;
    if (stepDropoffName) stepDropoffName.textContent = `Deliver: ${m.dropoffName}`;
    const isPickup = m.phase === "to_pickup";
    stepPickupEl?.classList.toggle("is-current", isPickup);
    stepPickupEl?.classList.toggle("is-done", !isPickup);
    stepDropoffEl?.classList.toggle("is-current", !isPickup);
    stepDropoffEl?.classList.remove("is-done");
  }

  const boardKey = `${m?.id || ""}|${(state.availableMissions || []).map((item) => item.id).join(",")}`;
  if (missionList && boardKey !== lastRenderedBoardKey) {
    lastRenderedBoardKey = boardKey;
    missionList.replaceChildren();
    if (!state.availableMissions || state.availableMissions.length === 0) {
      const empty = document.createElement("div");
      empty.className = "mission-card";
      empty.textContent = "Loading island routes…";
      missionList.appendChild(empty);
    } else {
      for (const route of state.availableMissions) {
        const card = document.createElement("div");
        card.className = "mission-card";

        const info = document.createElement("div");
        info.className = "mission-card-info";

        const title = document.createElement("div");
        title.className = "mission-card-title";
        title.textContent = route.title;

        const sub = document.createElement("div");
        sub.className = "mission-card-route";
        sub.textContent = `${route.pickupName} -> ${route.dropoffName}`;

        const meta = document.createElement("div");
        meta.className = "mission-card-meta";
        meta.textContent = `${route.cargo} · ${route.routeDistance} m · +${route.rewardCredits} cr`;

        info.appendChild(title);
        info.appendChild(sub);
        info.appendChild(meta);

        const acceptBtn = document.createElement("button");
        acceptBtn.type = "button";
        acceptBtn.className = "ops-btn ops-btn-secondary";
        acceptBtn.textContent = m ? "Switch" : "Accept";
        acceptBtn.addEventListener("click", () => {
          missionSystem?.acceptMission(route, { source: "board" });
        });

        card.appendChild(info);
        card.appendChild(acceptBtn);
        missionList.appendChild(card);
      }
    }
  }

  updateMissionTelemetryUI(state);
}

function syncRadioUnreadBadge() {
  if (!radioUnreadCount) return;
  if (unreadRadioCount > 0) {
    radioUnreadCount.textContent = unreadRadioCount > 9 ? "9+" : String(unreadRadioCount);
    radioUnreadCount.hidden = false;
  } else {
    radioUnreadCount.hidden = true;
  }
}

function renderRadioFeed() {
  if (!radioFeed) return;
  radioFeed.replaceChildren();
  const selfId = mpClient?.getSelfId?.();

  if (radioMessages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "radio-msg";
    const head = document.createElement("div");
    head.className = "radio-msg-head";
    const sender = document.createElement("span");
    sender.className = "radio-msg-sender";
    sender.textContent = "Channel 04";
    head.appendChild(sender);
    const body = document.createElement("div");
    body.className = "radio-msg-body";
    body.textContent =
      "Shared island radio & Police Dispatch. Say hello to couriers online or ask Officer Sunny for a mission.";
    empty.appendChild(head);
    empty.appendChild(body);
    radioFeed.appendChild(empty);
    return;
  }

  for (const msg of radioMessages) {
    const item = document.createElement("div");
    item.className = "radio-msg";
    const isSelf =
      msg.senderKind === "player" &&
      ((selfId && msg.senderId === selfId) || msg.senderId === "local");
    if (msg.senderKind === "dispatch") item.classList.add("is-dispatch");
    if (isSelf) item.classList.add("is-self");
    if (msg.isError) item.classList.add("is-error");

    const head = document.createElement("div");
    head.className = "radio-msg-head";

    const sender = document.createElement("span");
    sender.className = "radio-msg-sender";
    if (msg.senderKind === "dispatch") {
      sender.textContent = msg.unitCode
        ? `Officer Sunny · ${msg.unitCode}`
        : "Officer Sunny · Dispatch";
    } else if (isSelf) {
      sender.textContent = `${msg.senderName || "Patrol Unit"} (You)`;
    } else {
      sender.textContent = msg.senderName || "Radio";
    }

    const time = document.createElement("span");
    time.className = "radio-msg-time";
    time.textContent = formatRadioTime(msg.ts);

    head.appendChild(sender);
    head.appendChild(time);

    if (!msg.isError && (msg.senderKind === "dispatch" || msg.senderKind === "player")) {
      const listenBtn = document.createElement("button");
      listenBtn.type = "button";
      listenBtn.className = "radio-speak-btn";
      listenBtn.textContent = "Speak";
      const isDispatchMsg = msg.senderKind === "dispatch";
      listenBtn.addEventListener("click", () => {
        const peer = msg.senderId ? mpPeers.get(msg.senderId) : null;
        void voiceNarrator?.speak(msg.text, {
          persona: isDispatchMsg ? "dispatch" : "player",
          voiceName: isDispatchMsg ? undefined : msg.voice || peer?.voice || localPlayerVoice,
          speakerLabel: isDispatchMsg ? "Officer Sunny" : msg.senderName || "Explorer",
          force: true,
        });
      });
      head.appendChild(listenBtn);
    }

    const body = document.createElement("div");
    body.className = "radio-msg-body";
    body.textContent = msg.text;

    item.appendChild(head);
    item.appendChild(body);

    if (msg.dispatchMission) {
      const dm = msg.dispatchMission;
      const card = document.createElement("div");
      card.className = "radio-dispatch-card";

      const title = document.createElement("div");
      title.className = "radio-dispatch-title";
      title.textContent = `${dm.title} · +${dm.rewardCredits} cr`;

      const route = document.createElement("div");
      route.className = "radio-dispatch-route";
      route.textContent = `${dm.cargo}: ${dm.pickupName} -> ${dm.dropoffName}`;

      const acceptBtn = document.createElement("button");
      acceptBtn.type = "button";
      acceptBtn.className = "ops-btn ops-btn-primary";
      acceptBtn.textContent = "Accept Assignment";
      acceptBtn.addEventListener("click", () => {
        missionSystem?.acceptMission(dm, { source: "dispatch" });
        openOpsDrawer("missions");
      });

      card.appendChild(title);
      card.appendChild(route);
      card.appendChild(acceptBtn);
      item.appendChild(card);
    }

    radioFeed.appendChild(item);
  }
  radioFeed.scrollTop = radioFeed.scrollHeight;
}

function appendRadioMessage(entry, opts = {}) {
  if (!entry || typeof entry.text !== "string" || !entry.text.trim()) return;
  const selfId = mpClient?.getSelfId?.();

  if (entry.id && radioMessages.some((m) => m.id === entry.id)) {
    return;
  }

  // Reconcile optimistic local player message with server mp_chat echo
  if (entry.senderKind === "player" && !entry.optimistic && selfId && entry.senderId === selfId) {
    const optIdx = radioMessages.findIndex(
      (m) =>
        m.optimistic &&
        m.senderKind === "player" &&
        m.text === entry.text &&
        Math.abs((entry.ts || Date.now()) - m.ts) < 8000,
    );
    if (optIdx >= 0) {
      radioMessages[optIdx] = { ...entry, optimistic: false };
      renderRadioFeed();
      return;
    }
  }

  radioMessages.push(entry);
  if (radioMessages.length > 60) {
    radioMessages = radioMessages.slice(-60);
  }

  const isVisibleRadio = opsDrawerOpen && opsActiveTab === "radio";
  const isFromSelf =
    entry.optimistic ||
    (selfId && entry.senderId === selfId) ||
    entry.senderId === "local";
  if (!isVisibleRadio && !isFromSelf && !opts.silentUnread) {
    unreadRadioCount += 1;
    syncRadioUnreadBadge();
  }

  if (isVisibleRadio || radioMessages.length <= 2) {
    renderRadioFeed();
  }
}

function seedRadioHistory(historyList) {
  if (!Array.isArray(historyList) || historyList.length === 0) {
    renderRadioFeed();
    return;
  }
  for (const item of historyList) {
    if (!item || typeof item.id !== "string") continue;
    appendRadioMessage(item, { silentUnread: true });
  }
  renderRadioFeed();
}

function closeNpcDialog() {
  if (npcDialogTimer) {
    clearTimeout(npcDialogTimer);
    npcDialogTimer = null;
  }
  if (npcDialogCard) npcDialogCard.hidden = true;
}

function openNpcDialog({ name, meta, body, actions = [], autoDismissMs = 0 }) {
  if (!npcDialogCard || isOgCapture) return;
  if (npcDialogTimer) {
    clearTimeout(npcDialogTimer);
    npcDialogTimer = null;
  }
  if (npcDialogName) npcDialogName.textContent = name || "Neighbor";
  if (npcDialogMeta) npcDialogMeta.textContent = meta || "";
  if (npcDialogBody) npcDialogBody.textContent = body || "";
  if (npcDialogActions) {
    npcDialogActions.replaceChildren();
    if (Array.isArray(actions) && actions.length > 0) {
      for (const act of actions) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `ops-btn ${act.variant || "ops-btn-secondary"}`;
        btn.textContent = act.label || "OK";
        btn.addEventListener("click", () => {
          act.onClick?.();
        });
        npcDialogActions.appendChild(btn);
      }
      npcDialogActions.hidden = false;
    } else {
      npcDialogActions.hidden = true;
    }
  }
  npcDialogCard.hidden = false;
  if (autoDismissMs > 0) {
    npcDialogTimer = setTimeout(() => {
      closeNpcDialog();
    }, autoDismissMs);
  }
}

function syncDistrictIndicator(px, pz) {
  const city = getDistrictAt(px, pz);
  if (!city) return;
  if (city.id !== lastDistrictId) {
    lastDistrictId = city.id;
    if (currentCityName) currentCityName.textContent = city.name;
    if (currentCitySub) currentCitySub.textContent = city.subtitle;
    if (citiesTriggerLabel) {
      citiesTriggerLabel.textContent = city.badge || "Cities";
    }
    if (opsDrawerOpen && opsActiveTab === "cities") {
      renderCitiesPanel();
    }
  }
}

function applyAppearanceGearPatch(patch) {
  if (!patch || typeof patch !== "object") return;
  const current =
    engine?.getLocalAppearance?.() || characterBuilder?.getAppearance?.() || {};
  const merged = sanitizeAppearance({ ...current, ...patch });
  saveAppearance(merged);
  engine?.setLocalAppearance?.(merged);
  syncAvatarSwatchDot(merged);
  mpClient?.sendProfile?.(merged);
}

function syncWalkBoostStatus(econ = getEconomyState()) {
  const remainMs = Math.max(0, (econ.walkBoostUntil || 0) - Date.now());
  const active = remainMs > 500;
  engine?.setWalkSpeedMultiplier?.(active ? 1.38 : 1.0);
  if (shopBoostStatus) {
    if (active) {
      const remainSec = Math.ceil(remainMs / 1000);
      shopBoostStatus.textContent = `Sprint Boost Active (+38% · ${remainSec}s)`;
    } else {
      shopBoostStatus.textContent = "Earn credits via Deliveries & Races";
    }
  }
  if (active && !walkBoostTimer) {
    walkBoostTimer = setInterval(() => {
      const cur = getEconomyState();
      if ((cur.walkBoostUntil || 0) <= Date.now()) {
        clearInterval(walkBoostTimer);
        walkBoostTimer = null;
        engine?.setWalkSpeedMultiplier?.(1.0);
        if (shopBoostStatus) {
          shopBoostStatus.textContent = "Earn credits via Deliveries & Races";
        }
      } else if (shopBoostStatus) {
        const s = Math.ceil((cur.walkBoostUntil - Date.now()) / 1000);
        shopBoostStatus.textContent = `Sprint Boost Active (+38% · ${s}s)`;
      }
    }, 1000);
  }
}

function syncEconomyUI(econ = getEconomyState()) {
  if (walletTriggerCredits) walletTriggerCredits.textContent = String(econ.credits);
  if (shopWalletCredits) shopWalletCredits.textContent = `${econ.credits} cr`;
  if (statCredits) statCredits.textContent = String(econ.credits);
  if (racePbLap) racePbLap.textContent = formatRaceMs(econ.bestLapMs);
  if (raceTuneSummary) {
    const sp = econ.raceUpgrades?.topSpeedLevel || 0;
    const nt = econ.raceUpgrades?.nitroLevel || 0;
    raceTuneSummary.textContent =
      sp === 0 && nt === 0 ? "Stock Spec" : `Speed +${sp} · Nitro +${nt}`;
  }
  syncWalkBoostStatus(econ);
  if (opsDrawerOpen && opsActiveTab === "shop") {
    renderShopPanel();
  }
  if (opsDrawerOpen && opsActiveTab === "race") {
    renderRacePanel();
  }
}

function renderCitiesPanel() {
  if (!citiesList || isOgCapture) return;
  const pos = engine?.getPlayerPosition?.() || { x: 0, z: 0 };
  const current = getDistrictAt(pos.x, pos.z);
  if (currentCityName) currentCityName.textContent = current.name;
  if (currentCitySub) currentCitySub.textContent = current.subtitle;

  const cities = buildCitiesWithWorldData(worldData, pos.x, pos.z);
  citiesList.replaceChildren();
  for (const c of cities) {
    const card = document.createElement("div");
    card.className = "city-card";
    if (c.id === current.id) card.classList.add("is-current");

    const top = document.createElement("div");
    top.className = "city-card-top";

    const title = document.createElement("div");
    title.className = "city-card-title";
    title.textContent = c.name;

    const meta = document.createElement("div");
    meta.className = "city-card-meta";
    meta.textContent = `${c.buildingCount} places · ${c.storeCount} shops · ${c.distFromPlayer} m`;

    top.appendChild(title);
    top.appendChild(meta);
    card.appendChild(top);

    const sub = document.createElement("div");
    sub.className = "city-card-meta";
    sub.textContent = c.subtitle;
    card.appendChild(sub);

    if (c.landmarks && c.landmarks.length > 0) {
      const lm = document.createElement("div");
      lm.className = "city-card-landmarks";
      lm.textContent = `Highlights: ${c.landmarks.map((l) => l.name).join(", ")}`;
      card.appendChild(lm);
    }

    const actions = document.createElement("div");
    actions.className = "city-card-actions";

    const flyBtn = document.createElement("button");
    flyBtn.type = "button";
    flyBtn.className = "ops-btn ops-btn-secondary";
    flyBtn.textContent = "Fly Camera";
    flyBtn.addEventListener("click", () => {
      closeOpsDrawer();
      engine?.teleportTo?.(c.centerX, c.centerZ, { enterWalk: false });
      showToast(`Flying over ${c.name}`, 2800);
    });

    const walkBtn = document.createElement("button");
    walkBtn.type = "button";
    walkBtn.className = "ops-btn ops-btn-primary";
    walkBtn.textContent = "Walk Here";
    walkBtn.addEventListener("click", () => {
      closeOpsDrawer();
      engine?.teleportTo?.(c.spawnX, c.spawnZ, { enterWalk: true });
      showToast(`Arrived in ${c.name}`, 2800);
    });

    actions.appendChild(flyBtn);
    actions.appendChild(walkBtn);
    card.appendChild(actions);
    citiesList.appendChild(card);
  }
}

async function fetchRaceLeaderboard() {
  try {
    const res = await fetch("/api/race-leaderboard");
    if (!res.ok) return;
    const data = await res.json();
    if (data?.ok && Array.isArray(data.leaderboard)) {
      raceLeaderboard = data.leaderboard;
      raceLeaderboardLoaded = true;
      if (opsDrawerOpen && opsActiveTab === "race") {
        renderRaceLeaderboard();
      }
    }
  } catch {
    // Ignore transient network errors
  }
}

function renderRaceLeaderboard() {
  if (!raceLeaderboardList) return;
  raceLeaderboardList.replaceChildren();
  if (!raceLeaderboard || raceLeaderboard.length === 0) {
    const empty = document.createElement("div");
    empty.className = "race-lb-row";
    empty.innerHTML = `<span class="race-lb-rank">--</span><span class="race-lb-name">Complete a Grand Prix to set the island record!</span><span class="race-lb-time">--:--.-</span>`;
    raceLeaderboardList.appendChild(empty);
    return;
  }
  raceLeaderboard.slice(0, 8).forEach((entry, idx) => {
    const row = document.createElement("div");
    row.className = "race-lb-row";
    const rank = document.createElement("span");
    rank.className = "race-lb-rank";
    rank.textContent = `#${idx + 1}`;
    const name = document.createElement("span");
    name.className = "race-lb-name";
    name.textContent = `${entry.driverName || entry.playerName || "Racer"} · ${entry.carName || "Roadster"}`;
    const time = document.createElement("span");
    time.className = "race-lb-time";
    time.textContent = formatRaceMs(entry.bestLapMs);
    row.appendChild(rank);
    row.appendChild(name);
    row.appendChild(time);
    raceLeaderboardList.appendChild(row);
  });
}

function renderRacePanel() {
  const econ = getEconomyState();
  if (racePbLap) racePbLap.textContent = formatRaceMs(econ.bestLapMs);
  if (raceTuneSummary) {
    const sp = econ.raceUpgrades?.topSpeedLevel || 0;
    const nt = econ.raceUpgrades?.nitroLevel || 0;
    raceTuneSummary.textContent =
      sp === 0 && nt === 0 ? "Stock Spec" : `Speed +${sp} · Nitro +${nt}`;
  }

  if (raceCarList) {
    raceCarList.replaceChildren();
    for (const car of SHOP_CARS) {
      const unlocked = econ.unlockedCars.includes(car.id);
      const selected = econ.selectedCar === car.id;
      const card = document.createElement("div");
      card.className = "race-car-card";
      if (selected) card.classList.add("is-selected");

      const top = document.createElement("div");
      top.className = "race-car-top";

      const nameEl = document.createElement("div");
      nameEl.className = "race-car-name";
      nameEl.textContent = car.name;

      const statEl = document.createElement("div");
      statEl.className = "race-car-desc";
      statEl.textContent = `Top ${car.topSpeedKmh} km/h · Nitro x${car.nitroPower.toFixed(2)}`;

      top.appendChild(nameEl);
      top.appendChild(statEl);
      card.appendChild(top);

      const desc = document.createElement("div");
      desc.className = "race-car-desc";
      desc.textContent = car.tagline;
      card.appendChild(desc);

      const actionBtn = document.createElement("button");
      actionBtn.type = "button";
      if (selected) {
        actionBtn.className = "ops-btn ops-btn-accent";
        actionBtn.textContent = "Selected for Grid";
        actionBtn.disabled = true;
      } else if (unlocked) {
        actionBtn.className = "ops-btn ops-btn-primary";
        actionBtn.textContent = "Select Car";
        actionBtn.addEventListener("click", () => {
          selectCar(car.id);
          renderRacePanel();
        });
      } else {
        actionBtn.className = "ops-btn ops-btn-secondary";
        actionBtn.textContent = `Unlock in Garage (${car.price} cr)`;
        actionBtn.addEventListener("click", () => {
          activeShopStore = "breezeway_motors";
          openOpsDrawer("shop");
        });
      }
      card.appendChild(actionBtn);
      raceCarList.appendChild(card);
    }
  }
  renderRaceLeaderboard();
}

async function handleRaceFinish(result) {
  if (!result || raceFinishedHandled) return;
  raceFinishedHandled = true;
  const place = Math.max(1, Math.min(4, Math.round(Number(result.place) || 4)));
  const prizes = [120, 80, 55, 35];
  const prizeCredits = prizes[place - 1] || 35;

  addCredits(prizeCredits);
  recordRaceOutcome({ bestLapMs: result.bestLapMs, place });

  const localApp = engine?.getLocalAppearance?.();
  const playerName =
    typeof localApp?.name === "string" && localApp.name.trim()
      ? localApp.name.trim().slice(0, 20)
      : "Island Racer";

  try {
    const res = await fetch("/api/race-leaderboard", {
      method: "POST",
      headers: buildVisitorHeaders({
        "content-type": "application/json",
        "x-meadow-client": "1",
      }),
      body: JSON.stringify({
        driverName: playerName,
        carName: result.carName || getCarSpec(getEconomyState().selectedCar).name,
        bestLapMs: Math.round(result.bestLapMs || result.totalMs || 45_000),
        totalMs: Math.round(result.totalMs || result.bestLapMs || 90_000),
        place,
      }),
    });
    const data = await res.json().catch(() => null);
    if (data?.visitorToken) storeVisitorToken(data.visitorToken);
    if (data?.ok && Array.isArray(data.leaderboard)) {
      raceLeaderboard = data.leaderboard;
      raceLeaderboardLoaded = true;
    }
  } catch {
    // Ignore transient network errors posting score
  }

  const placeStr = formatOrdinalPlace(place, 4);
  soundEngine?.playRaceFinish?.(place);
  showToast(`Finished ${placeStr}! Won +${prizeCredits} cr`, 5200);
  if (voiceNarrator?.getState?.().enabled) {
    void voiceNarrator.speak(
      `Checkered flag! Finished ${placeStr} in ${formatRaceMs(result.totalMs)} and earned ${prizeCredits} credits.`,
      { persona: "race", speakerLabel: "Race Chief" },
    );
  }
  openNpcDialog({
    name: `Grand Prix Finish · ${placeStr}`,
    meta: `${result.carName || "Race Car"} · Prize +${prizeCredits} cr`,
    body: `Best Lap: ${formatRaceMs(result.bestLapMs)} · Total Time: ${formatRaceMs(result.totalMs)}. Spend your prize credits at Island Stores or tune your car!`,
    actions: [
      {
        label: "Race Again",
        variant: "ops-btn-primary",
        onClick: () => {
          closeNpcDialog();
          launchGrandPrix();
        },
      },
      {
        label: "Open Shop",
        variant: "ops-btn-secondary",
        onClick: () => {
          closeNpcDialog();
          engine?.exitCarRace?.({ enterWalk: false });
          openOpsDrawer("shop");
        },
      },
      {
        label: "Exit Car",
        variant: "ops-btn-ghost",
        onClick: () => {
          closeNpcDialog();
          engine?.exitCarRace?.({ enterWalk: true });
        },
      },
    ],
  });
}

function launchGrandPrix() {
  if (isOgCapture || !engine) return;
  const econ = getEconomyState();
  raceFinishedHandled = false;
  closeNpcDialog();
  closeOpsDrawer();
  engine.startCarRace({
    carId: econ.selectedCar || "roadster",
    upgrades: econ.raceUpgrades || {},
    laps: 2,
    onFinish: handleRaceFinish,
  });
  showToast("Grand Prix! W/Up = Gas · A/D = Steer · Space/Shift = Nitro", 4800);
}

function renderRaceHud(status) {
  if (!raceHud) return;
  const active = Boolean(status?.active) && !isOgCapture;
  raceHud.hidden = !active;
  if (active) {
    document.body.dataset.racing = "1";
  } else {
    delete document.body.dataset.racing;
    return;
  }

  if (raceHudPlace) raceHudPlace.textContent = formatOrdinalPlace(status.place, status.totalRacers || 4);
  if (raceHudLap) raceHudLap.textContent = `${status.lap || 1} / ${status.totalLaps || 2}`;
  if (raceHudGates) raceHudGates.textContent = `${status.checkpoint || 0} / ${status.totalCheckpoints || 8}`;
  if (raceHudTime) raceHudTime.textContent = formatRaceMs(status.totalMs || 0);
  if (raceHudSpeed) raceHudSpeed.textContent = String(status.speedKmh || 0);
  if (raceHudNitroFill) {
    const pct = Math.max(0, Math.min(100, Number(status.nitro) || 0));
    raceHudNitroFill.style.width = `${pct}%`;
  }
  if (raceCamBtn) {
    raceCamBtn.textContent = status.cameraMode === "hood" ? "Chase" : "Hood";
  }
  if (raceCountdown) {
    if ((status.countdownSec || 0) > 0.05) {
      raceCountdown.textContent = status.countdownSec > 0.8 ? "READY…" : "SET…";
      raceCountdown.hidden = false;
    } else {
      raceCountdown.hidden = true;
    }
  }
  if (raceTouchControls) {
    raceTouchControls.hidden = !isMobileWalkViewport();
  }
}

function renderDeliveryRideHud(status) {
  if (!speedLevelHud || isOgCapture) return;
  const isMounted = Boolean(status?.active);
  const isRacing = Boolean(engine?.getRaceStatus?.()?.active);

  if (isMounted) {
    speedLevelHud.hidden = false;
    if (speedValEl) speedValEl.textContent = String(status.speedKmh || 0);
    if (speedVehicleNameEl) speedVehicleNameEl.textContent = "Courier Scooter";
    if (speedLevelBadgeEl) {
      speedLevelBadgeEl.textContent = `L${status.speedLevel} ${status.speedLevelName}`;
      speedLevelBadgeEl.style.backgroundColor = status.speedLevelColor || "#3b82f6";
    }

    const pills = speedLevelHud.querySelectorAll(".speed-lvl-pill");
    pills.forEach((p) => {
      const lvl = Number(p.dataset.speedLevel);
      p.classList.toggle("is-active", lvl === status.speedLevel);
    });

    if (deliveryRideDockBtn) {
      const label = deliveryRideDockBtn.querySelector(".ops-trigger-label");
      if (label) label.textContent = "Dismount [R]";
    }
    if (missionRideBtn) missionRideBtn.textContent = "🛵 Dismount Scooter [R]";
    if (minimapRideBtn) minimapRideBtn.textContent = "🛵 Dismount";
  } else if (!isRacing) {
    speedLevelHud.hidden = true;
    if (deliveryRideDockBtn) {
      const label = deliveryRideDockBtn.querySelector(".ops-trigger-label");
      if (label) label.textContent = "Ride [R]";
    }
    if (missionRideBtn) missionRideBtn.textContent = "🛵 Ride Scooter [R]";
    if (minimapRideBtn) minimapRideBtn.textContent = "🛵 Scooter [R]";
  }
}

function toggleCameraViewMode() {
  if (!engine) return;
  const next = engine.toggleCameraViewMode?.();
  if (camViewLabel) {
    camViewLabel.textContent = next === "third_person" ? "3rd Person" : "1st Person";
  }
  if (camViewBtn) {
    camViewBtn.classList.toggle("is-1p", next === "first_person");
    camViewBtn.setAttribute("aria-pressed", next === "third_person" ? "true" : "false");
  }
  showToast(next === "third_person" ? "Camera: 3rd Person View (Character Visible)" : "Camera: 1st Person View", 2200);
}

function toggleHideHud(force) {
  const isHidden = typeof force === "boolean" ? force : document.body.dataset.hudHidden !== "1";
  if (isHidden) {
    document.body.dataset.hudHidden = "1";
    if (unhideHudPill) unhideHudPill.hidden = false;
  } else {
    delete document.body.dataset.hudHidden;
    if (unhideHudPill) unhideHudPill.hidden = true;
  }
}

function sendPlayerGreeting(text) {
  if (!engine) return;
  const clean = (text || "Hey friend! 👋").trim();
  engine.showLocalGreeting?.(clean);
  soundEngine?.playGreetingPing?.();
  const speaker = localAppearance?.name || "You";
  void voiceNarrator?.speak?.(clean, { persona: "player", speakerLabel: speaker });
  mpClient?.sendChat?.(clean);
  showToast(`${speaker}: "${clean}"`, 3200);
  if (greetingBar) greetingBar.hidden = true;
}

function renderShopPanel() {
  if (!shopItemsList || isOgCapture) return;
  const econ = getEconomyState();
  if (shopWalletCredits) shopWalletCredits.textContent = `${econ.credits} cr`;
  syncWalkBoostStatus(econ);

  if (shopStoreFilters) {
    shopStoreFilters.replaceChildren();
    const filterOpts = [{ id: "all", name: "All Shops" }, ...SHOP_STORES];
    for (const f of filterOpts) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shop-filter-btn";
      if (activeShopStore === f.id) btn.classList.add("is-active");
      btn.textContent = f.name;
      btn.addEventListener("click", () => {
        activeShopStore = f.id;
        renderShopPanel();
      });
      shopStoreFilters.appendChild(btn);
    }
  }

  if (shopSatchelBox) {
    shopSatchelBox.replaceChildren();
    const entries = Object.entries(econ.consumables || {}).filter(([, qty]) => qty > 0);
    if (entries.length > 0) {
      shopSatchelBox.hidden = false;
      for (const [itemId, qty] of entries) {
        const item = SHOP_ITEMS.find((it) => it.id === itemId);
        if (!item) continue;
        const useBtn = document.createElement("button");
        useBtn.type = "button";
        useBtn.className = "ops-btn ops-btn-accent";
        useBtn.textContent = `Use ${item.name} (${qty})`;
        useBtn.addEventListener("click", () => {
          const res = useConsumable(item);
          if (res.ok) {
            soundEngine?.playShopChime?.();
            showToast(`${item.name} consumed! +38% sprint boost active!`, 3400);
          }
        });
        shopSatchelBox.appendChild(useBtn);
      }
    } else {
      shopSatchelBox.hidden = true;
    }
  }

  const items = getItemsForStore(activeShopStore);
  shopItemsList.replaceChildren();
  for (const item of items) {
    const card = document.createElement("div");
    card.className = "shop-item-card";

    const top = document.createElement("div");
    top.className = "shop-card-top";

    const title = document.createElement("div");
    title.className = "shop-item-title";
    title.textContent = item.name;

    const price = document.createElement("div");
    price.className = "shop-item-price";
    price.textContent = `${item.price} cr`;

    top.appendChild(title);
    top.appendChild(price);
    card.appendChild(top);

    const desc = document.createElement("div");
    desc.className = "shop-item-desc";
    desc.textContent = item.desc;
    card.appendChild(desc);

    const foot = document.createElement("div");
    foot.className = "shop-item-foot";

    const tag = document.createElement("span");
    tag.className = "shop-item-tag";
    const storeInfo = SHOP_STORES.find((s) => s.id === item.storeId);
    tag.textContent = storeInfo ? `${item.tag} · ${storeInfo.name}` : item.tag;

    const actionBtn = document.createElement("button");
    actionBtn.type = "button";

    const isOwned = econ.ownedItems.includes(item.id);
    if (item.kind === "car_unlock") {
      const carOwned = econ.unlockedCars.includes(item.carId);
      if (econ.selectedCar === item.carId) {
        actionBtn.className = "ops-btn ops-btn-accent";
        actionBtn.textContent = "Selected Car";
        actionBtn.disabled = true;
      } else if (carOwned) {
        actionBtn.className = "ops-btn ops-btn-secondary";
        actionBtn.textContent = "Select Car";
        actionBtn.addEventListener("click", () => {
          selectCar(item.carId);
          showToast(`Selected ${item.name} for Grand Prix!`, 2600);
        });
      } else {
        actionBtn.className = "ops-btn ops-btn-primary";
        actionBtn.textContent = `Buy · ${item.price} cr`;
        actionBtn.disabled = econ.credits < item.price;
        actionBtn.addEventListener("click", () => {
          const res = buyShopItem(item);
          if (res.ok) {
            soundEngine?.playShopChime?.();
            showToast(`Unlocked ${item.name}! Ready in Race tab.`, 3600);
          } else {
            showToast(res.reason || "Not enough credits", 2600);
          }
        });
      }
    } else if (item.kind === "race_upgrade") {
      if (isOwned) {
        actionBtn.className = "ops-btn ops-btn-secondary";
        actionBtn.textContent = "Installed";
        actionBtn.disabled = true;
      } else {
        actionBtn.className = "ops-btn ops-btn-primary";
        actionBtn.textContent = `Install · ${item.price} cr`;
        actionBtn.disabled = econ.credits < item.price;
        actionBtn.addEventListener("click", () => {
          const res = buyShopItem(item);
          if (res.ok) {
            soundEngine?.playShopChime?.();
            showToast(`Installed ${item.name}!`, 3200);
          } else {
            showToast(res.reason || "Not enough credits", 2600);
          }
        });
      }
    } else if (item.kind === "avatar") {
      const isEquipped = item.slot && econ.equippedGear?.[item.slot] === item.id;
      if (isEquipped) {
        actionBtn.className = "ops-btn ops-btn-accent";
        actionBtn.textContent = "Equipped";
        actionBtn.addEventListener("click", () => {
          const res = equipShopItem(item);
          if (res.ok && res.appearancePatch) applyAppearanceGearPatch(res.appearancePatch);
        });
      } else if (isOwned) {
        actionBtn.className = "ops-btn ops-btn-secondary";
        actionBtn.textContent = "Equip";
        actionBtn.addEventListener("click", () => {
          const res = equipShopItem(item);
          if (res.ok && res.appearancePatch) {
            soundEngine?.playShopChime?.();
            applyAppearanceGearPatch(res.appearancePatch);
            showToast(`Equipped ${item.name}!`, 2600);
          }
        });
      } else {
        actionBtn.className = "ops-btn ops-btn-primary";
        actionBtn.textContent = `Buy · ${item.price} cr`;
        actionBtn.disabled = econ.credits < item.price;
        actionBtn.addEventListener("click", () => {
          const res = buyShopItem(item);
          if (res.ok) {
            soundEngine?.playShopChime?.();
            if (res.appearancePatch) applyAppearanceGearPatch(res.appearancePatch);
            showToast(`Purchased & equipped ${item.name}!`, 3400);
          } else {
            showToast(res.reason || "Not enough credits", 2600);
          }
        });
      }
    } else {
      const qty = econ.consumables?.[item.id] || 0;
      actionBtn.className = "ops-btn ops-btn-primary";
      actionBtn.textContent = qty > 0 ? `Buy (+1 · ${qty} owned)` : `Buy · ${item.price} cr`;
      actionBtn.disabled = econ.credits < item.price;
      actionBtn.addEventListener("click", () => {
        const res = buyShopItem(item);
        if (res.ok) {
          soundEngine?.playShopChime?.();
          if (res.activatedBoost) {
            showToast(`${item.name} active! +38% walking speed boost!`, 3600);
          } else {
            showToast(`Added ${item.name} to your satchel!`, 2800);
          }
        } else {
          showToast(res.reason || "Not enough credits", 2600);
        }
      });
    }

    foot.appendChild(tag);
    foot.appendChild(actionBtn);
    card.appendChild(foot);
    shopItemsList.appendChild(card);
  }
}

function syncOpsTabUI() {
  if (!opsDrawer || isOgCapture) return;
  opsDrawer.hidden = !opsDrawerOpen;

  const isMap = opsActiveTab === "map";
  const isCities = opsActiveTab === "cities";
  const isRace = opsActiveTab === "race";
  const isShop = opsActiveTab === "shop";
  const isMissions = opsActiveTab === "missions";
  const isRadio = opsActiveTab === "radio";
  const isPlayers = opsActiveTab === "players";

  mapToggleBtn?.classList.toggle("is-active", opsDrawerOpen && isMap);
  mapToggleBtn?.setAttribute("aria-expanded", opsDrawerOpen && isMap ? "true" : "false");

  citiesToggleBtn?.classList.toggle("is-active", opsDrawerOpen && isCities);
  citiesToggleBtn?.setAttribute("aria-expanded", opsDrawerOpen && isCities ? "true" : "false");

  raceToggleBtn?.classList.toggle("is-active", opsDrawerOpen && isRace);
  raceToggleBtn?.setAttribute("aria-expanded", opsDrawerOpen && isRace ? "true" : "false");

  shopToggleBtn?.classList.toggle("is-active", opsDrawerOpen && isShop);
  shopToggleBtn?.setAttribute("aria-expanded", opsDrawerOpen && isShop ? "true" : "false");

  missionToggleBtn?.classList.toggle("is-active", opsDrawerOpen && isMissions);
  missionToggleBtn?.setAttribute("aria-expanded", opsDrawerOpen && isMissions ? "true" : "false");

  radioToggleBtn?.classList.toggle("is-active", opsDrawerOpen && isRadio);
  radioToggleBtn?.setAttribute("aria-expanded", opsDrawerOpen && isRadio ? "true" : "false");

  onlinePill?.classList.toggle("is-active", opsDrawerOpen && isPlayers);
  onlinePill?.setAttribute("aria-expanded", opsDrawerOpen && isPlayers ? "true" : "false");

  opsTabMap?.classList.toggle("is-active", isMap);
  opsTabMap?.setAttribute("aria-selected", isMap ? "true" : "false");

  opsTabCities?.classList.toggle("is-active", isCities);
  opsTabCities?.setAttribute("aria-selected", isCities ? "true" : "false");

  opsTabRace?.classList.toggle("is-active", isRace);
  opsTabRace?.setAttribute("aria-selected", isRace ? "true" : "false");

  opsTabShop?.classList.toggle("is-active", isShop);
  opsTabShop?.setAttribute("aria-selected", isShop ? "true" : "false");

  opsTabMissions?.classList.toggle("is-active", isMissions);
  opsTabMissions?.setAttribute("aria-selected", isMissions ? "true" : "false");

  opsTabRadio?.classList.toggle("is-active", isRadio);
  opsTabRadio?.setAttribute("aria-selected", isRadio ? "true" : "false");

  opsTabPlayers?.classList.toggle("is-active", isPlayers);
  opsTabPlayers?.setAttribute("aria-selected", isPlayers ? "true" : "false");

  if (mapPanel) mapPanel.hidden = !isMap;
  if (citiesPanel) citiesPanel.hidden = !isCities;
  if (racePanel) racePanel.hidden = !isRace;
  if (shopPanel) shopPanel.hidden = !isShop;
  if (missionsPanel) missionsPanel.hidden = !isMissions;
  if (radioPanel) radioPanel.hidden = !isRadio;
  if (playersPanel) playersPanel.hidden = !isPlayers;

  if (opsDrawerOpen && isRadio) {
    unreadRadioCount = 0;
    syncRadioUnreadBadge();
    renderRadioFeed();
  }
  if (opsDrawerOpen && isPlayers) {
    renderPlayersPanel();
  }
}

function openOpsDrawer(tab = "missions") {
  if (isOgCapture) return;
  const validTabs = new Set(["map", "cities", "race", "shop", "missions", "radio", "players"]);
  opsActiveTab = validTabs.has(tab) ? tab : "missions";
  opsDrawerOpen = true;
  hoverCard.hidden = true;
  resetWalkJoystick();
  engine?.releaseWalkPointerLock?.();
  syncOpsTabUI();
  if (opsActiveTab === "map") {
    refreshNavigationAndMaps({ forceSteps: true });
  } else if (opsActiveTab === "cities") {
    renderCitiesPanel();
  } else if (opsActiveTab === "race") {
    renderRacePanel();
    if (!raceLeaderboardLoaded) {
      void fetchRaceLeaderboard();
    }
  } else if (opsActiveTab === "shop") {
    renderShopPanel();
  } else if (opsActiveTab === "players") {
    renderPlayersPanel();
  } else if (opsActiveTab === "missions" && missionSystem) {
    missionSystem.updateProgress();
    renderMissionState(missionSystem.getState());
  }
}

function closeOpsDrawer() {
  opsDrawerOpen = false;
  syncOpsTabUI();
}

async function sendPoliceRadioMessage(rawText) {
  const clean = typeof rawText === "string" ? rawText.replace(/\s+/g, " ").trim().slice(0, 220) : "";
  if (!clean || isOgCapture) return;

  const localApp = engine?.getLocalAppearance?.();
  const playerName =
    typeof localApp?.name === "string" && localApp.name.trim()
      ? localApp.name.trim().slice(0, 20)
      : "Patrol Unit";

  const sentOverMp = mpClient?.sendChat?.(clean) || false;
  appendRadioMessage({
    id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    senderKind: "player",
    senderId: mpClient?.getSelfId?.() || "local",
    senderName: playerName,
    text: clean,
    ts: Date.now(),
    optimistic: sentOverMp,
  });

  if (!radioAiCheckbox?.checked) {
    return;
  }

  if (aiDispatchInFlight) {
    showToast("Officer Sunny is responding to your previous transmission…");
    return;
  }

  aiDispatchInFlight = true;
  if (radioSendBtn) {
    radioSendBtn.disabled = true;
    radioSendBtn.textContent = "Sending…";
  }

  try {
    const status = engine?.getDeliveryStatus?.();
    const playerPos =
      status && Number.isFinite(status.playerX) && Number.isFinite(status.playerZ)
        ? { x: Math.round(status.playerX * 10) / 10, z: Math.round(status.playerZ * 10) / 10 }
        : null;
    const history = radioMessages
      .filter((m) => !m.isError && (m.senderKind === "dispatch" || m.senderKind === "player"))
      .slice(-8)
      .map((m) => ({
        role: m.senderKind === "dispatch" ? "dispatch" : "player",
        name: m.senderName || "Unit",
        text: m.text,
      }));

    const res = await fetch("/api/police-chat", {
      method: "POST",
      headers: buildVisitorHeaders({
        "content-type": "application/json",
        "x-meadow-client": "1",
      }),
      body: JSON.stringify({
        message: clean,
        playerName,
        playerPos,
        activeMission: missionSystem?.getPoliceContext?.() || null,
        history,
      }),
    });
    const data = await res.json().catch(() => null);
    if (data?.visitorToken) storeVisitorToken(data.visitorToken);

    if (!res.ok || !data?.ok) {
      appendRadioMessage({
        id: `err-${Date.now().toString(36)}`,
        senderKind: "system",
        senderName: "Dispatch Radio",
        text: data?.error || "Police Dispatch could not respond right now — try again.",
        isError: true,
        ts: Date.now(),
      });
      return;
    }

    appendRadioMessage({
      id: `dsp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      senderKind: "dispatch",
      senderName: "Officer Sunny",
      unitCode: data.unitCode || "10-4 · Unit 04",
      text: data.reply,
      dispatchMission: data.dispatchMission || null,
      ts: Date.now(),
    });
    if (voiceNarrator?.getState?.().enabled) {
      void voiceNarrator.speak(data.reply, {
        persona: "dispatch",
        speakerLabel: "Officer Sunny",
      });
    }
  } catch {
    appendRadioMessage({
      id: `err-${Date.now().toString(36)}`,
      senderKind: "system",
      senderName: "Dispatch Radio",
      text: "Network hiccup reaching Police Dispatch — check connection and try again.",
      isError: true,
      ts: Date.now(),
    });
  } finally {
    aiDispatchInFlight = false;
    if (radioSendBtn) {
      radioSendBtn.disabled = false;
      radioSendBtn.textContent = "Send";
    }
  }
}

function renderVoiceBarUI(vState) {
  if (!voiceBar || !vState || isOgCapture) return;
  voiceBar.classList.toggle("is-loading", Boolean(vState.loading));
  voiceBar.classList.toggle("is-speaking", Boolean(vState.speaking));
  voiceBar.classList.toggle("has-error", Boolean(vState.lastError));

  if (voiceToggleBtn) {
    voiceToggleBtn.classList.toggle("is-on", Boolean(vState.enabled));
    voiceToggleBtn.setAttribute("aria-pressed", vState.enabled ? "true" : "false");
    voiceToggleBtn.textContent = vState.enabled ? "Voice On" : "Muted";
  }

  if (voiceReplayBtn) {
    voiceReplayBtn.disabled = vState.loading || !vState.hasReplay;
    voiceReplayBtn.textContent = vState.needsUnlock ? "Play" : "Listen";
  }

  if (voiceSpeakerBadge) {
    if (!vState.enabled) {
      voiceSpeakerBadge.textContent = "AI Voice · Muted";
    } else if (vState.loading) {
      voiceSpeakerBadge.textContent = `${vState.lastSpeakerLabel || "AI Voice"} · Generating…`;
    } else if (vState.speaking) {
      voiceSpeakerBadge.textContent = `${vState.lastSpeakerLabel || "AI Voice"} · Speaking`;
    } else {
      voiceSpeakerBadge.textContent = `${vState.lastSpeakerLabel || "AI Voice"} · Ready`;
    }
  }

  if (voiceCaption) {
    if (vState.lastError) {
      voiceCaption.textContent = vState.lastError;
    } else if (vState.lastText) {
      voiceCaption.textContent = vState.lastText;
    } else {
      voiceCaption.textContent = "Turn-by-turn GPS & Officer Sunny voice ready.";
    }
  }
}

voiceNarrator = createVoiceNarrator({
  getHeaders: buildVisitorHeaders,
  onVisitorToken: storeVisitorToken,
  onStateChange: renderVoiceBarUI,
});
renderVoiceBarUI(voiceNarrator.getState());
window.__geminIslandVoice = voiceNarrator;

function renderSoundAndMicUI() {
  if (isOgCapture) return;
  const sState = soundEngine?.getState?.();
  if (soundToggleBtn && sState) {
    soundToggleBtn.classList.toggle("is-muted", !sState.enabled);
    soundToggleBtn.setAttribute("aria-pressed", sState.enabled ? "true" : "false");
    if (soundToggleLabel) {
      soundToggleLabel.textContent = sState.enabled ? "Sound" : "Muted";
    }
  }

  const mState = voiceChatCtrl?.getState?.();
  if (!mState) return;
  const isTalking = Boolean(mState.pushToTalkActive || mState.speaking);
  if (pttMicBtn) {
    pttMicBtn.classList.toggle("is-talking", isTalking);
    pttMicBtn.classList.toggle("is-mic-on", Boolean(mState.openMic));
    pttMicBtn.setAttribute("aria-pressed", isTalking ? "true" : "false");
    if (pttMicLabel) {
      pttMicLabel.textContent = mState.pushToTalkActive
        ? "Talking…"
        : mState.openMic
          ? mState.speaking
            ? "Speaking"
            : "Mic Live"
          : "Talk [V]";
    }
  }
  if (mpMicOpenBtn) {
    mpMicOpenBtn.classList.toggle("is-mic-on", Boolean(mState.openMic));
    mpMicOpenBtn.setAttribute("aria-pressed", mState.openMic ? "true" : "false");
    mpMicOpenBtn.textContent = mState.openMic ? "Mic Live" : "Mic Off";
  }
  if (mpMicPttBtn) {
    mpMicPttBtn.classList.toggle("is-talking", Boolean(mState.pushToTalkActive));
    mpMicPttBtn.textContent = mState.pushToTalkActive ? "Transmitting…" : "Hold Talk [V]";
  }
  if (mpMicMeterFill) {
    const pct = Math.min(100, Math.round((mState.micLevel || 0) * 100));
    mpMicMeterFill.style.width = `${pct}%`;
  }

  const musState = musicEngine?.getState?.();
  if (musState) {
    if (musicToggleBtn) {
      musicToggleBtn.classList.toggle("is-muted", !musState.enabled);
      musicToggleBtn.classList.toggle("is-playing", Boolean(musState.enabled && musState.playing));
      musicToggleBtn.setAttribute("aria-pressed", musState.enabled ? "true" : "false");
    }
    if (musicToggleLabel) {
      musicToggleLabel.textContent = musState.enabled ? "Music" : "Music Off";
    }
    if (musicThemeLabel) {
      musicThemeLabel.textContent = musState.enabled
        ? musState.activeThemeTitle || "Sunlit Island Breeze"
        : "Paused";
    }
    if (musicStationSelect && musicStationSelect.value !== musState.station) {
      musicStationSelect.value = musState.station;
    }
    if (musicVolumeRange && document.activeElement !== musicVolumeRange) {
      musicVolumeRange.value = String(Math.round((musState.volume || 0.44) * 100));
    }
  }
}

soundEngine = createSoundEngine({
  onStateChange: () => {
    musicEngine?.syncFromUnlock?.();
    renderSoundAndMicUI();
  },
});
window.__geminIslandSound = soundEngine;

musicEngine = createBackgroundMusicEngine({
  getAudioGraph: () => soundEngine?.getAudioGraph?.(),
  unlockAudio: () => soundEngine?.unlock?.(),
  onStateChange: renderSoundAndMicUI,
});
window.__geminIslandMusic = musicEngine;

voiceChatCtrl = createPlayerVoiceChatController({
  getMpClient: () => mpClient,
  soundEngine,
  getLocalPose: () => {
    const st = engine?.getAudioWorldState?.();
    return {
      x: st?.playerX || 0,
      z: st?.playerZ || 0,
      yaw: st?.playerYaw || 0,
      room: st?.roomId || null,
    };
  },
  onStateChange: renderSoundAndMicUI,
  onPeerSpeakingChange(peerId, speaking) {
    const rec = mpPeers.get(peerId);
    if (rec) {
      rec.speaking = Boolean(speaking);
    }
    engine?.setPeerVoiceState?.(peerId, { speaking: Boolean(speaking) });
    if (opsDrawerOpen && opsActiveTab === "players") {
      renderPlayersPanel();
    }
  },
  onToast(msg, ms) {
    showToast(msg, ms);
  },
});

if (mpVoiceSelect) {
  mpVoiceSelect.value = localPlayerVoice;
}
renderSoundAndMicUI();

if (!isOgCapture) {
  const unlockAudioOnce = () => {
    soundEngine?.unlock?.();
    musicEngine?.syncFromUnlock?.();
  };
  window.addEventListener("pointerdown", unlockAudioOnce, { passive: true });
  window.addEventListener("keydown", unlockAudioOnce, { passive: true });
  window.addEventListener("touchstart", unlockAudioOnce, { passive: true });
}

function getViewerGeoPose() {
  const camState = engine?.getCameraState?.();
  if (!camState) {
    return { x: 0, z: 0, yaw: 0 };
  }
  if (camState.fpActive) {
    return {
      x: camState.fpX || 0,
      z: camState.fpZ || 0,
      yaw: camState.fpYaw || 0,
    };
  }
  return {
    x: camState.tx || 0,
    z: camState.tz || 0,
    yaw: camState.az || 0,
  };
}

function getActiveNavDestination(missionState) {
  const m = missionState?.activeMission;
  if (m) {
    const isPickup = m.phase === "to_pickup";
    return {
      kind: isPickup ? "pickup" : "dropoff",
      name: isPickup ? m.pickupName : m.dropoffName,
      x: Number(m.waypointX ?? (isPickup ? m.pickupX : m.dropoffX)) || 0,
      z: Number(m.waypointZ ?? (isPickup ? m.pickupZ : m.dropoffZ)) || 0,
      isDelivery: true,
      mission: m,
    };
  }
  if (customMapTarget) {
    return { ...customMapTarget, isDelivery: false };
  }
  return null;
}

function maybeAnnounceDeliveryVoice(missionState, route) {
  if (!voiceNarrator?.getState?.().enabled || isOgCapture) return;
  const m = missionState?.activeMission;
  if (!m) {
    if (lastSpokenMissionSignature && missionState?.lastCompletionSummary) {
      const done = missionState.lastCompletionSummary;
      if (Date.now() - done.ts < 4500) {
        lastSpokenMissionSignature = "";
        announcedApproachLeg = "";
        void voiceNarrator.speak(
          `Delivery complete to ${done.dropoffName}! You earned ${done.earned} credits.`,
          { persona: "dispatch", speakerLabel: "Officer Sunny" },
        );
      }
    } else {
      lastSpokenMissionSignature = "";
      announcedApproachLeg = "";
    }
    return;
  }

  const sig = `${m.id}:${m.phase}`;
  if (sig !== lastSpokenMissionSignature) {
    lastSpokenMissionSignature = sig;
    announcedApproachLeg = "";
    const legPrompt =
      m.phase === "to_pickup"
        ? `Route to pick up ${m.cargo} at ${m.pickupName}. ${route?.nextInstruction || ""}`
        : `Parcel collected. Head to ${m.dropoffName} to deliver ${m.cargo}. ${route?.nextInstruction || ""}`;
    void voiceNarrator.speak(legPrompt, {
      persona: "gps",
      speakerLabel: "GPS Nav",
    });
    return;
  }

  const dist = missionState?.liveProgress?.distMeters;
  if (typeof dist === "number" && dist <= 16 && announcedApproachLeg !== sig) {
    announcedApproachLeg = sig;
    const destName = m.phase === "to_pickup" ? m.pickupName : m.dropoffName;
    const action = m.phase === "to_pickup" ? "pick up parcel" : "complete delivery";
    void voiceNarrator.speak(
      `Arriving at ${destName}. Walk close and press E to ${action}.`,
      { persona: "gps", speakerLabel: "GPS Nav" },
    );
  }
}

function refreshNavigationAndMaps(opts = {}) {
  if (isOgCapture || !engine) return;
  const pose = getViewerGeoPose();
  const missionState = missionSystem?.getState?.() || null;
  const target = getActiveNavDestination(missionState);

  if (target) {
    currentRoute = computeRoute(worldData, pose.x, pose.z, target.x, target.z, target.name);
  } else {
    currentRoute = null;
  }

  const peersArr = Array.from(mpPeers.values());
  const policeOverlay = engine?.getMapOverlayState?.() || null;

  // Render Corner Minimap Radar
  if (minimapCanvas) {
    renderMinimapCanvas(minimapCanvas, {
      worldData,
      playerX: pose.x,
      playerZ: pose.z,
      playerYaw: pose.yaw,
      activeMission: missionState?.activeMission || null,
      customTarget: customMapTarget,
      route: currentRoute,
      peers: peersArr,
      policeOverlay,
    });
  }

  if (minimapDistEl && minimapTurnEl) {
    if (target && currentRoute) {
      const prefix =
        target.kind === "pickup" ? "Pickup" : target.kind === "dropoff" ? "Deliver" : "Pin";
      minimapDistEl.textContent = `${prefix} · ${currentRoute.totalMeters} m`;
      minimapTurnEl.textContent = currentRoute.steps?.[0]?.instruction || target.name;
    } else {
      const city = getDistrictAt(pose.x, pose.z);
      minimapDistEl.textContent = city?.badge || "Island GPS";
      minimapTurnEl.textContent = "Tap map for route";
    }
  }

  // Render Interactive Map Tab when open
  if (opsDrawerOpen && opsActiveTab === "map") {
    if (fullMapCanvas) {
      renderFullMapCanvas(fullMapCanvas, {
        worldData,
        playerX: pose.x,
        playerZ: pose.z,
        playerYaw: pose.yaw,
        activeMission: missionState?.activeMission || null,
        customTarget: customMapTarget,
        route: currentRoute,
        view: mapView,
        hoverHit: mapHoverHit,
        peers: peersArr,
        policeOverlay,
      });
    }

    if (target && currentRoute) {
      if (mapRouteTitle) {
        const tag =
          target.kind === "pickup"
            ? "Pickup"
            : target.kind === "dropoff"
              ? "Dropoff"
              : "Destination";
        mapRouteTitle.textContent = `${tag}: ${target.name}`;
      }
      if (mapRouteMeta) {
        mapRouteMeta.textContent = `${currentRoute.totalMeters} m along roads (${currentRoute.directMeters} m direct)`;
      }
      if (mapNextStep) {
        mapNextStep.textContent = currentRoute.nextInstruction || `Head to ${target.name}`;
      }
      if (mapEtaLabel) {
        mapEtaLabel.textContent = `Walk ETA ~${formatClockSec(currentRoute.etaWalkSec)}`;
      }
      if (mapWalkBtn) mapWalkBtn.disabled = false;
      if (mapFlyBtn) mapFlyBtn.disabled = false;
      if (mapClearPinBtn) mapClearPinBtn.hidden = Boolean(target.isDelivery);
      if (mapSpeakBtn) mapSpeakBtn.disabled = false;

      const stepsKey = currentRoute.steps.map((s) => `${s.index}:${s.instruction}`).join("|");
      if (mapStepsList && (opts.forceSteps || stepsKey !== lastMapStepsKey)) {
        lastMapStepsKey = stepsKey;
        mapStepsList.replaceChildren();
        for (const step of currentRoute.steps) {
          const row = document.createElement("div");
          row.className = "map-step-row";
          if (step.kind === "arrive") row.classList.add("is-arrive");

          const idxEl = document.createElement("span");
          idxEl.className = "map-step-idx";
          idxEl.textContent = String(step.index);

          const textEl = document.createElement("span");
          textEl.className = "map-step-text";
          textEl.textContent = step.instruction;

          row.appendChild(idxEl);
          row.appendChild(textEl);
          mapStepsList.appendChild(row);
        }
      }
    } else {
      if (mapRouteTitle) mapRouteTitle.textContent = "Tap anywhere on map to set route";
      if (mapRouteMeta) mapRouteMeta.textContent = "Road-network GPS · Click a building or drop a pin";
      if (mapNextStep) {
        mapNextStep.textContent = "Accept a delivery or click any building/district on the map.";
      }
      if (mapEtaLabel) mapEtaLabel.textContent = "Walk ETA --";
      if (mapWalkBtn) mapWalkBtn.disabled = true;
      if (mapFlyBtn) mapFlyBtn.disabled = true;
      if (mapClearPinBtn) mapClearPinBtn.hidden = true;
      if (mapSpeakBtn) mapSpeakBtn.disabled = false;
      if (mapStepsList && (opts.forceSteps || lastMapStepsKey !== "empty")) {
        lastMapStepsKey = "empty";
        mapStepsList.replaceChildren();
      }
    }
  }
}

missionSystem = createDeliveryMissionController({
  engine,
  onStateChange(nextState) {
    renderMissionState(nextState);
    refreshNavigationAndMaps({ forceSteps: true });
    maybeAnnounceDeliveryVoice(nextState, currentRoute);
  },
  onMissionToast(msg, durationMs) {
    showToast(msg, durationMs);
  },
});
window.__geminIslandMissions = missionSystem;

renderMissionState(missionSystem.getState());
renderRadioFeed();
syncEconomyUI(getEconomyState());
subscribeEconomy((econ) => {
  syncEconomyUI(econ);
});

if (!isOgCapture) {
  setInterval(() => {
    refreshNavigationAndMaps();
  }, 180);

  setInterval(() => {
    if (!engine || !soundEngine) return;
    const aState = engine.getAudioWorldState?.();
    if (!aState) return;
    soundEngine.updateWorldState(aState);

    const anyPeerSpeaking = Array.from(mpPeers.values()).some((p) => Boolean(p?.speaking));
    const voiceActiveNow = Boolean(
      voiceNarrator?.getState?.().speaking ||
        voiceChatCtrl?.getState?.().speaking ||
        anyPeerSpeaking,
    );
    musicEngine?.setDucked?.(voiceActiveNow);
    musicEngine?.updateWorldState?.({
      weatherMode: aState.weatherMode,
      isRacing: aState.isRacing,
      isInside: aState.isInside,
      wantedStars: aState.wantedStars,
      activeRobbery: Boolean(aState.activeRobbery),
    });

    const viewerPose = {
      x: aState.playerX,
      z: aState.playerZ,
      yaw: aState.playerYaw,
      room: aState.roomId || null,
    };
    const peerList = engine.getRemotePeerSpatialList?.() || [];
    voiceChatCtrl?.updateSpatialMix?.(viewerPose, peerList);

    // Race 3-2-1 countdown & GO sound cues
    const r = aState.raceStatus;
    if (r?.active) {
      const cd = Number(r.countdownSec) || 0;
      const bucket = cd > 0.04 ? Math.ceil(cd) : 0;
      if (!lastRaceActive && bucket > 0) {
        lastRaceCountdownInt = bucket;
        soundEngine.playRaceCountdown(bucket);
      } else if (bucket !== lastRaceCountdownInt && (bucket > 0 || lastRaceCountdownInt > 0)) {
        lastRaceCountdownInt = bucket;
        soundEngine.playRaceCountdown(bucket);
      }
      lastRaceActive = true;
    } else {
      lastRaceActive = false;
      lastRaceCountdownInt = -1;
    }

    // Heist safe-cracking ticks
    if (aState.activeRobbery) {
      const pBucket = Math.floor((aState.activeRobbery.progress01 || 0) * 10);
      if (pBucket !== lastHeistProgressBucket && pBucket < 10) {
        lastHeistProgressBucket = pBucket;
        soundEngine.playHeistTick(aState.activeRobbery.progress01 || 0);
      }
    } else {
      lastHeistProgressBucket = -1;
    }
  }, 80);
}

voiceToggleBtn?.addEventListener("click", () => {
  const on = voiceNarrator.toggle();
  showToast(on ? "AI Voice-Over enabled" : "AI Voice-Over muted", 2200);
  voiceToggleBtn.blur();
});

voiceReplayBtn?.addEventListener("click", () => {
  const st = voiceNarrator.getState();
  if (st.hasReplay) {
    void voiceNarrator.replayLast();
  } else if (currentRoute?.voiceBrief) {
    void voiceNarrator.speak(currentRoute.voiceBrief, {
      persona: "gps",
      speakerLabel: "GPS Nav",
      force: true,
    });
  } else {
    void voiceNarrator.speak(
      "Welcome to GeminIsland GPS. Accept a delivery or click a landmark on the map for voice directions.",
      { persona: "gps", speakerLabel: "GPS Nav", force: true },
    );
  }
  voiceReplayBtn.blur();
});

minimapOpenBtn?.addEventListener("click", () => {
  openOpsDrawer("map");
});

mapToggleBtn?.addEventListener("click", () => {
  if (opsDrawerOpen && opsActiveTab === "map") {
    closeOpsDrawer();
  } else {
    openOpsDrawer("map");
  }
  mapToggleBtn.blur();
});

mapZoomInBtn?.addEventListener("click", () => {
  mapView.zoom = Math.min(3.8, mapView.zoom * 1.32);
  refreshNavigationAndMaps();
});

mapZoomOutBtn?.addEventListener("click", () => {
  mapView.zoom = Math.max(0.9, mapView.zoom / 1.32);
  refreshNavigationAndMaps();
});

mapCenterBtn?.addEventListener("click", () => {
  const pose = getViewerGeoPose();
  mapView.panX = pose.x;
  mapView.panZ = pose.z;
  mapView.zoom = Math.max(1.5, mapView.zoom);
  refreshNavigationAndMaps();
});

mapFitBtn?.addEventListener("click", () => {
  mapView = { zoom: 1.05, panX: 0, panZ: 0 };
  refreshNavigationAndMaps();
});

mapSpeakBtn?.addEventListener("click", () => {
  if (currentRoute?.voiceBrief) {
    void voiceNarrator.speak(currentRoute.voiceBrief, {
      persona: "gps",
      speakerLabel: "GPS Nav",
      force: true,
    });
  } else {
    const pose = getViewerGeoPose();
    const city = getDistrictAt(pose.x, pose.z);
    void voiceNarrator.speak(
      `You are in ${city?.name || "GeminIsland"}. Tap any landmark on the map or accept a delivery for turn-by-turn directions.`,
      { persona: "gps", speakerLabel: "GPS Nav", force: true },
    );
  }
});

mapWalkBtn?.addEventListener("click", () => {
  const dest = getActiveNavDestination(missionSystem?.getState?.());
  if (!dest) return;
  closeOpsDrawer();
  engine?.teleportTo?.(dest.x - 3, dest.z + 3, { enterWalk: true });
  showToast(`Walking near ${dest.name}`, 2800);
});

mapFlyBtn?.addEventListener("click", () => {
  const dest = getActiveNavDestination(missionSystem?.getState?.());
  if (!dest) return;
  closeOpsDrawer();
  engine?.focusOn?.(dest.x, dest.z, 1.5);
  showToast(`Focusing camera on ${dest.name}`, 2600);
});

mapClearPinBtn?.addEventListener("click", () => {
  customMapTarget = null;
  refreshNavigationAndMaps({ forceSteps: true });
});

if (fullMapCanvas) {
  let mapDrag = null;

  fullMapCanvas.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    mapDrag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      moved: false,
    };
    try {
      fullMapCanvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic capture failures
    }
  });

  fullMapCanvas.addEventListener("pointermove", (e) => {
    const stateObj = {
      worldData,
      view: mapView,
      peers: Array.from(mpPeers.values()),
      policeOverlay: engine?.getMapOverlayState?.() || null,
    };
    if (mapDrag && mapDrag.pointerId === e.pointerId) {
      const dx = e.clientX - mapDrag.lastX;
      const dy = e.clientY - mapDrag.lastY;
      if (Math.hypot(e.clientX - mapDrag.startX, e.clientY - mapDrag.startY) > 5) {
        mapDrag.moved = true;
      }
      if (mapDrag.moved) {
        const w = fullMapCanvas.clientWidth || 360;
        const h = fullMapCanvas.clientHeight || 240;
        const pxScale = (Math.min(w, h) / 364) * mapView.zoom;
        mapView.panX = Math.max(-140, Math.min(140, mapView.panX - dx / pxScale));
        mapView.panZ = Math.max(-140, Math.min(140, mapView.panZ - dy / pxScale));
        mapDrag.lastX = e.clientX;
        mapDrag.lastY = e.clientY;
        refreshNavigationAndMaps();
      }
      return;
    }
    const hit = hitTestFullMap(fullMapCanvas, e.clientX, e.clientY, stateObj);
    const nextId = hit?.name || "";
    const prevId = mapHoverHit?.name || "";
    if (nextId !== prevId) {
      mapHoverHit = hit && hit.kind !== "point" ? hit : null;
      refreshNavigationAndMaps();
    }
  });

  fullMapCanvas.addEventListener("pointerup", (e) => {
    if (!mapDrag || mapDrag.pointerId !== e.pointerId) return;
    const wasDrag = mapDrag.moved;
    mapDrag = null;
    if (!wasDrag) {
      const hit = hitTestFullMap(fullMapCanvas, e.clientX, e.clientY, {
        worldData,
        view: mapView,
        peers: Array.from(mpPeers.values()),
        policeOverlay: engine?.getMapOverlayState?.() || null,
      });
      if (hit) {
        customMapTarget = hit;
        refreshNavigationAndMaps({ forceSteps: true });
        if (hit.kind === "bank") {
          showToast("Route set to Island Treasury Bank — walk up to the vault to rob!", 3600);
        } else if (hit.kind === "basketball") {
          showToast("Route set to Streetball Half-Court!", 3000);
        }
        if (currentRoute?.voiceBrief && voiceNarrator?.getState?.().enabled) {
          void voiceNarrator.speak(currentRoute.voiceBrief, {
            persona: "gps",
            speakerLabel: "GPS Nav",
          });
        }
      }
    }
  });

  fullMapCanvas.addEventListener("pointerleave", () => {
    if (mapHoverHit) {
      mapHoverHit = null;
      refreshNavigationAndMaps();
    }
  });

  fullMapCanvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      mapView.zoom = Math.max(0.9, Math.min(3.8, mapView.zoom * factor));
      refreshNavigationAndMaps();
    },
    { passive: false },
  );
}

citiesToggleBtn?.addEventListener("click", () => {
  if (opsDrawerOpen && opsActiveTab === "cities") {
    closeOpsDrawer();
  } else {
    openOpsDrawer("cities");
  }
  citiesToggleBtn.blur();
});

raceToggleBtn?.addEventListener("click", () => {
  if (opsDrawerOpen && opsActiveTab === "race") {
    closeOpsDrawer();
  } else {
    openOpsDrawer("race");
  }
  raceToggleBtn.blur();
});

shopToggleBtn?.addEventListener("click", () => {
  if (opsDrawerOpen && opsActiveTab === "shop") {
    closeOpsDrawer();
  } else {
    openOpsDrawer("shop");
  }
  shopToggleBtn.blur();
});

missionToggleBtn?.addEventListener("click", () => {
  if (opsDrawerOpen && opsActiveTab === "missions") {
    closeOpsDrawer();
  } else {
    openOpsDrawer("missions");
  }
  missionToggleBtn.blur();
});

radioToggleBtn?.addEventListener("click", () => {
  if (opsDrawerOpen && opsActiveTab === "radio") {
    closeOpsDrawer();
  } else {
    openOpsDrawer("radio");
    if (window.innerWidth > 640) {
      radioInput?.focus({ preventScroll: true });
    }
  }
  radioToggleBtn.blur();
});

opsTabMap?.addEventListener("click", () => {
  openOpsDrawer("map");
});

opsTabCities?.addEventListener("click", () => {
  openOpsDrawer("cities");
});

opsTabRace?.addEventListener("click", () => {
  openOpsDrawer("race");
});

opsTabShop?.addEventListener("click", () => {
  openOpsDrawer("shop");
});

opsTabMissions?.addEventListener("click", () => {
  openOpsDrawer("missions");
});

opsTabRadio?.addEventListener("click", () => {
  openOpsDrawer("radio");
});

opsTabPlayers?.addEventListener("click", () => {
  openOpsDrawer("players");
});

onlinePill?.addEventListener("click", () => {
  if (opsDrawerOpen && opsActiveTab === "players") {
    closeOpsDrawer();
  } else {
    openOpsDrawer("players");
  }
  onlinePill.blur();
});

opsCloseBtn?.addEventListener("click", () => {
  closeOpsDrawer();
});

poiBankBtn?.addEventListener("click", () => {
  closeOpsDrawer();
  engine?.teleportTo?.(22.5, 25.5, { enterWalk: true });
  showToast("Island Treasury Bank — approach the gold vault and press E to rob!", 4000);
});

poiCourtBtn?.addEventListener("click", () => {
  closeOpsDrawer();
  engine?.teleportTo?.(18.2, 16.2, { enterWalk: true });
  openBasketballHud();
});

robStoreBtn?.addEventListener("click", () => {
  startStoreOrBankRobbery();
});

weatherCycleBtn?.addEventListener("click", () => {
  const cur = engine?.getWeatherState?.()?.mode || "clear";
  const next = cur === "clear" ? "rain" : cur === "rain" ? "snow" : "clear";
  const st = engine?.setWeatherMode?.(next, { source: "manual" });
  if (st) syncWeatherBarUI(st);
  weatherCycleBtn.blur();
});

weatherRandomBtn?.addEventListener("click", () => {
  const st = engine?.triggerRandomWeatherEvent?.();
  if (st) syncWeatherBarUI(st);
  weatherRandomBtn.blur();
});

heistCancelBtn?.addEventListener("click", () => {
  engine?.cancelRobbery?.("Aborted");
});

function handlePoliceStopAction(action) {
  if (!engine) return;
  const res = engine.resolvePoliceStop(action, {
    hasActiveMission: Boolean(missionSystem?.getState?.().activeMission),
  });
  closePoliceStopCard();
  if (!res) return;
  if (res.finePaid > 0) {
    addCredits(-res.finePaid);
  }
  showToast(res.message || "Police stop resolved", 4400);
  appendRadioMessage({
    id: `stop-${Date.now().toString(36)}`,
    senderKind: "dispatch",
    senderName: "Officer Sunny",
    unitCode: "Unit 04 · Stop",
    text: res.message,
    ts: Date.now(),
  });
  if (voiceNarrator?.getState?.().enabled) {
    void voiceNarrator.speak(res.message, {
      persona: "dispatch",
      speakerLabel: "Officer Sunny",
    });
  }
}

stopComplyBtn?.addEventListener("click", () => {
  handlePoliceStopAction("comply");
});

stopBluffBtn?.addEventListener("click", () => {
  handlePoliceStopAction("bluff");
});

stopFleeBtn?.addEventListener("click", () => {
  handlePoliceStopAction("flee");
});

bballCloseBtn?.addEventListener("click", () => {
  closeBasketballHud();
});

bballShootBtn?.addEventListener("click", () => {
  shootBasketballNow();
  bballShootBtn.blur();
});

for (const btn of bballSpotBtns) {
  btn.addEventListener("click", () => {
    bballSpotIdx = Math.max(0, Math.min(2, Number(btn.getAttribute("data-bball-spot")) || 0));
    for (const other of bballSpotBtns) {
      other.classList.toggle("is-active", other === btn);
    }
    renderBballWeatherHint(engine?.getWeatherState?.());
  });
}

mpCopyInviteBtn?.addEventListener("click", async () => {
  const shareUrl = `${location.origin}${location.pathname}`;
  try {
    await navigator.clipboard?.writeText?.(shareUrl);
    showToast("Island multiplayer link copied!", 2600);
  } catch {
    showToast(`Share URL: ${shareUrl}`, 3600);
  }
});

mpNameForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const nextName = (mpNameInput?.value || "").replace(/\s+/g, " ").trim().slice(0, 20);
  if (!nextName) return;
  applyAppearanceGearPatch({ name: nextName });
  showToast(`Courier callsign updated to "${nextName}"`, 2600);
});

mpEmoteWaveBtn?.addEventListener("click", () => {
  engine?.triggerLocalWave?.();
  mpClient?.sendEmote?.("wave");
  soundEngine?.playEmoteVoice?.("wave", { pan: 0, gain: 0.9, voice: localPlayerVoice });
});

mpEmoteJumpBtn?.addEventListener("click", () => {
  engine?.triggerLocalEmote?.("jump");
  mpClient?.sendEmote?.("jump");
  soundEngine?.playEmoteVoice?.("jump", { pan: 0, gain: 0.9, voice: localPlayerVoice });
});

mpEmoteCheerBtn?.addEventListener("click", () => {
  engine?.triggerLocalEmote?.("cheer");
  mpClient?.sendEmote?.("cheer");
  soundEngine?.playEmoteVoice?.("cheer", { pan: 0, gain: 0.9, voice: localPlayerVoice });
});

soundToggleBtn?.addEventListener("click", () => {
  const on = soundEngine?.toggle?.();
  showToast(on ? "World Sound Effects & Soundscapes enabled" : "World Sound Effects muted", 2200);
  soundToggleBtn.blur();
});

musicToggleBtn?.addEventListener("click", () => {
  const on = musicEngine?.toggle?.();
  const st = musicEngine?.getState?.();
  showToast(
    on ? `Background Music: ${st?.activeThemeTitle || "On"}` : "Background Music paused",
    2400,
  );
  musicToggleBtn.blur();
});

function setMusicPopoverOpen(open) {
  if (!musicPopover || !musicMenuBtn) return;
  musicPopover.hidden = !open;
  musicMenuBtn.setAttribute("aria-expanded", open ? "true" : "false");
}

musicMenuBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  const nextOpen = Boolean(musicPopover?.hidden);
  setMusicPopoverOpen(nextOpen);
  musicMenuBtn.blur();
});

musicPopover?.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
});

document.addEventListener("pointerdown", (e) => {
  if (!musicPopover || musicPopover.hidden) return;
  const target = e.target;
  if (
    target instanceof Node &&
    !musicPopover.contains(target) &&
    target !== musicMenuBtn &&
    !musicMenuBtn?.contains(target)
  ) {
    setMusicPopoverOpen(false);
  }
});

musicStationSelect?.addEventListener("change", () => {
  const station = musicEngine?.setStation?.(musicStationSelect.value);
  if (musicEngine && !musicEngine.getState().enabled) {
    musicEngine.setEnabled(true);
  }
  const st = musicEngine?.getState?.();
  showToast(
    station === "auto"
      ? `Music Station: Auto (${st?.activeThemeTitle || "Dynamic"})`
      : `Music Station: ${st?.activeThemeTitle || station}`,
    2500,
  );
});

musicVolumeRange?.addEventListener("input", () => {
  const pct = Math.max(10, Math.min(100, Number(musicVolumeRange.value) || 44));
  musicEngine?.setVolume?.(pct / 100);
});

function bindHoldPttButton(btn) {
  if (!btn) return;
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    void voiceChatCtrl?.startPushToTalk?.();
  });
  const endPtt = (e) => {
    e.preventDefault();
    e.stopPropagation();
    voiceChatCtrl?.stopPushToTalk?.();
  };
  btn.addEventListener("pointerup", endPtt);
  btn.addEventListener("pointercancel", endPtt);
  btn.addEventListener("pointerleave", () => {
    if (voiceChatCtrl?.getState?.().pushToTalkActive) {
      voiceChatCtrl.stopPushToTalk();
    }
  });
}
bindHoldPttButton(pttMicBtn);
bindHoldPttButton(mpMicPttBtn);

mpMicOpenBtn?.addEventListener("click", () => {
  void voiceChatCtrl?.toggleOpenMic?.();
  mpMicOpenBtn.blur();
});

mpVoiceSelect?.addEventListener("change", () => {
  localPlayerVoice = savePlayerVoice(mpVoiceSelect.value);
  const localApp = engine?.getLocalAppearance?.() || {};
  mpClient?.sendProfile?.({ ...localApp, voice: localPlayerVoice });
  soundEngine?.playEmoteVoice?.("wave", { pan: 0, gain: 0.9, voice: localPlayerVoice });
  showToast(`Player voice set to ${localPlayerVoice}`, 2400);
});

mpVoiceTestBtn?.addEventListener("click", () => {
  soundEngine?.playEmoteVoice?.("cheer", { pan: 0, gain: 0.9, voice: localPlayerVoice });
  void voiceNarrator?.speak("Voice check! Ready to roll across GeminIsland.", {
    persona: "player",
    voiceName: localPlayerVoice,
    speakerLabel: `Your Voice · ${localPlayerVoice}`,
    force: true,
  });
});

mpChatForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const txt = (mpChatInput?.value || "").replace(/\s+/g, " ").trim().slice(0, 220);
  if (!txt) return;
  if (mpChatInput) mpChatInput.value = "";
  const localApp = engine?.getLocalAppearance?.();
  const playerName =
    typeof localApp?.name === "string" && localApp.name.trim()
      ? localApp.name.trim().slice(0, 20)
      : "Explorer";
  const sent = mpClient?.sendChat?.(txt) || false;
  appendRadioMessage({
    id: `mp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    senderKind: "player",
    senderId: mpClient?.getSelfId?.() || "local",
    senderName: playerName,
    voice: localPlayerVoice,
    text: txt,
    ts: Date.now(),
    optimistic: sent,
  });
  showToast(`Sent: "${txt}"`, 2400);
});

npcDialogClose?.addEventListener("click", () => {
  closeNpcDialog();
});

startRaceBtn?.addEventListener("click", () => {
  launchGrandPrix();
});

gotoPaddockBtn?.addEventListener("click", () => {
  closeOpsDrawer();
  engine?.teleportTo?.(RACE_PADDOCK_POS.x - 4, RACE_PADDOCK_POS.z, { enterWalk: true });
  showToast("Walked to Grand Prix Start Paddock — press E to race!", 3400);
});

refreshRaceBoardBtn?.addEventListener("click", () => {
  void fetchRaceLeaderboard();
});

raceCamBtn?.addEventListener("click", () => {
  engine?.toggleRaceCam?.();
  raceCamBtn.blur();
});

raceRespawnBtn?.addEventListener("click", () => {
  engine?.respawnRaceCar?.();
  raceRespawnBtn.blur();
});

raceExitBtn?.addEventListener("click", () => {
  closeNpcDialog();
  engine?.exitCarRace?.({ enterWalk: true });
  raceExitBtn.blur();
});

function bindRaceTouchControl(btn, keyName, pressVal = true, releaseVal = false) {
  if (!btn) return;
  const setVal = (val) => {
    if (keyName === "steer") {
      engine?.setRaceTouchInput?.({ touchSteer: val });
    } else {
      engine?.setRaceTouchInput?.({ [keyName]: val });
    }
  };
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setVal(pressVal);
  });
  const end = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setVal(releaseVal);
  };
  btn.addEventListener("pointerup", end);
  btn.addEventListener("pointercancel", end);
  btn.addEventListener("pointerleave", end);
}

bindRaceTouchControl(raceTouchLeft, "steer", -1, 0);
bindRaceTouchControl(raceTouchRight, "steer", 1, 0);
bindRaceTouchControl(raceTouchGas, "fwd", true, false);
bindRaceTouchControl(raceTouchBrake, "back", true, false);
bindRaceTouchControl(raceTouchNitro, "nitro", true, false);

missionPrimaryBtn?.addEventListener("click", () => {
  const st = missionSystem?.getState?.();
  if (!st?.activeMission) return;
  if (st.liveProgress?.inRange) {
    missionSystem.completeCurrentStep();
  } else {
    missionSystem.focusCurrentWaypoint();
    closeOpsDrawer();
  }
});

missionMapBtn?.addEventListener("click", () => {
  openOpsDrawer("map");
});

missionWalkBtn?.addEventListener("click", () => {
  hoverCard.hidden = true;
  closeOpsDrawer();
  engine?.setDragMode("walk");
});

missionCancelBtn?.addEventListener("click", () => {
  missionSystem?.cancelMission();
});

refreshMissionsBtn?.addEventListener("click", () => {
  missionSystem?.refreshBoard();
});

askDispatchMissionBtn?.addEventListener("click", () => {
  openOpsDrawer("radio");
  if (radioAiCheckbox) radioAiCheckbox.checked = true;
  void sendPoliceRadioMessage("Requesting a delivery assignment nearby.");
});

for (const btn of radioQuickBtns) {
  btn.addEventListener("click", () => {
    const prompt = btn.getAttribute("data-radio-prompt") || "";
    if (!prompt) return;
    if (radioAiCheckbox && /traffic|delivery|places/i.test(prompt)) {
      radioAiCheckbox.checked = true;
    }
    void sendPoliceRadioMessage(prompt);
  });
}

radioForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const txt = radioInput?.value || "";
  if (!txt.trim()) return;
  if (radioInput) radioInput.value = "";
  void sendPoliceRadioMessage(txt);
});

interactPromptBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  engine?.triggerActiveInteraction?.();
  interactPromptBtn.blur();
});

interactSecondaryPromptBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  engine?.triggerSecondaryInteraction?.();
  interactSecondaryPromptBtn.blur();
});

characterBuilder = createCharacterBuilderController({
  dialogEl: avatarDialog,
  onChange(app) {
    engine?.setLocalAppearance?.(app);
    syncAvatarSwatchDot(app);
  },
  onSave(app) {
    engine?.setLocalAppearance?.(app);
    syncAvatarSwatchDot(app);
    mpClient?.sendProfile({ ...app, voice: localPlayerVoice });
  },
});

avatarDialog?.addEventListener("close", () => {
  lastAvatarDialogCloseMs = performance.now();
  avatarBtn?.blur();
  queueMicrotask(() => avatarBtn?.blur());
});

avatarDialog?.querySelector('[data-cb-action="wave"]')?.addEventListener("click", () => {
  engine?.triggerLocalWave?.();
  mpClient?.sendEmote("wave");
});

syncAvatarSwatchDot(engine?.getLocalAppearance?.() || characterBuilder?.getAppearance?.());

avatarBtn?.addEventListener("click", () => {
  if (isOgCapture) return;
  avatarBtn?.blur();
  hoverCard.hidden = true;
  resetWalkJoystick();
  engine?.releaseWalkPointerLock?.();
  characterBuilder?.open(engine?.getLocalAppearance?.());
});

walkEscHintBtn?.addEventListener("click", () => {
  hoverCard.hidden = true;
  engine?.setDragMode("pan");
  walkEscHintBtn.blur();
});

window.__geminIslandCharacterBuilder = characterBuilder;

camPanBtn?.addEventListener("click", () => {
  engine.setDragMode("pan");
});

camOrbitBtn?.addEventListener("click", () => {
  engine.setDragMode("orbit");
});

camWalkBtn?.addEventListener("click", () => {
  hoverCard.hidden = true;
  if (engine.isFirstPerson()) {
    engine.setDragMode("pan");
    return;
  }
  if (uiState === "picking" || uiState === "composing") {
    hideError();
    chosenSpot = null;
    uiState = "idle";
    syncDockUI();
  }
  engine.setDragMode("walk");
  camWalkBtn.blur();
});

recenterBtn?.addEventListener("click", () => {
  engine.recenterCamera();
  engine.setDragMode("pan");
});

window.addEventListener(
  "pointerdown",
  (e) => {
    if (e.pointerType === "touch" && !sawTouchInput) {
      sawTouchInput = true;
      syncWalkJoystickVisibility();
    }
  },
  { passive: true },
);

window.addEventListener("resize", () => {
  syncWalkJoystickVisibility();
  if (walkEscHintBtn) {
    walkEscHintBtn.hidden = isOgCapture || currentCamMode !== "walk" || isMobileWalkViewport();
  }
});

window.addEventListener("blur", () => {
  if (joyPointerId !== null) resetWalkJoystick();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" && joyPointerId !== null) {
    resetWalkJoystick();
  }
});

function updateWalkJoystickFromPoint(clientX, clientY) {
  if (!walkJoystick) return;
  const rect = walkJoystick.getBoundingClientRect();
  const cx = rect.left + rect.width * 0.5;
  const cy = rect.top + rect.height * 0.5;
  const maxPx = Math.max(24, rect.width * 0.31);
  const dx = clientX - cx;
  const dy = clientY - cy;
  const dist = Math.hypot(dx, dy);
  const clampedPx = Math.min(maxPx, dist);
  const ux = dist > 1e-4 ? dx / dist : 0;
  const uy = dist > 1e-4 ? dy / dist : 0;

  const maxSvg = 34;
  const svgX = ux * (clampedPx / maxPx) * maxSvg;
  const svgY = uy * (clampedPx / maxPx) * maxSvg;
  walkJoystickKnob?.setAttribute("transform", `translate(${svgX.toFixed(1)} ${svgY.toFixed(1)})`);

  const rawMag = clampedPx / maxPx;
  const deadzone = 0.08;
  const eff = rawMag <= deadzone ? 0 : (rawMag - deadzone) / (1 - deadzone);
  const moveRight = ux * eff;
  const moveFwd = -uy * eff;

  walkJoyUp?.classList.toggle("is-lit", moveFwd > 0.28);
  walkJoyDown?.classList.toggle("is-lit", moveFwd < -0.28);
  walkJoyLeft?.classList.toggle("is-lit", moveRight < -0.28);
  walkJoyRight?.classList.toggle("is-lit", moveRight > 0.28);

  engine?.setJoystickInput(moveRight, moveFwd);
}

if (walkJoystick) {
  walkJoystick.addEventListener("contextmenu", (e) => e.preventDefault());

  walkJoystick.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (joyPointerId !== null) return;
    joyPointerId = e.pointerId;
    walkJoystick.classList.add("is-active");
    hoverCard.hidden = true;
    try {
      walkJoystick.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointer events in tests may omit active capture handles
    }
    updateWalkJoystickFromPoint(e.clientX, e.clientY);
  });

  walkJoystick.addEventListener("pointermove", (e) => {
    if (joyPointerId !== e.pointerId) return;
    e.stopPropagation();
    e.preventDefault();
    updateWalkJoystickFromPoint(e.clientX, e.clientY);
  });

  const endJoystickGesture = (e) => {
    if (joyPointerId !== e.pointerId) return;
    e.stopPropagation();
    resetWalkJoystick();
  };

  walkJoystick.addEventListener("pointerup", endJoystickGesture);
  walkJoystick.addEventListener("pointercancel", endJoystickGesture);
  walkJoystick.addEventListener("lostpointercapture", endJoystickGesture);
}

function syncDockUI() {
  if (isOgCapture) return;

  addBtn.hidden = true;
  pickSpotPill.hidden = true;
  bottomBuilder.hidden = true;
  buildingPill.hidden = true;
  readyGotoBtn.hidden = true;
  locateMineBtn.hidden = true;

  if (myCreationId && uiState !== "ready") {
    uiState = "placed";
  }

  switch (uiState) {
    case "picking":
      pickSpotPill.hidden = false;
      engine.setSpotPickerState({
        mode: "picking",
        ...(chosenSpot ? { x: chosenSpot.x, z: chosenSpot.z } : {}),
      });
      break;
    case "composing":
      bottomBuilder.hidden = false;
      engine.setPreviewPrompt(promptInput.value);
      engine.setSpotPickerState({
        mode: "staked",
        x: chosenSpot?.x ?? 16,
        z: chosenSpot?.z ?? 10,
      });
      break;
    case "building":
      buildingPill.hidden = false;
      renderActiveJobLabel();
      engine.setSpotPickerState({
        mode: "building",
        x: chosenSpot?.x ?? 16,
        z: chosenSpot?.z ?? 10,
      });
      break;
    case "ready": {
      readyGotoBtn.hidden = false;
      const name = readyCreation?.name || "your creation";
      readyGotoLabel.textContent = `Ready · Go to ${name}`;
      engine.setSpotPickerState({ mode: "hidden" });
      break;
    }
    case "placed": {
      locateMineBtn.hidden = false;
      const mine = worldData?.creations?.find((c) => c.id === myCreationId);
      locateMineLabel.textContent = mine ? `Locate · ${mine.name}` : "Locate yours";
      engine.setSpotPickerState({ mode: "hidden" });
      break;
    }
    default:
      addBtn.hidden = false;
      engine.setSpotPickerState({ mode: "hidden" });
      break;
  }
}

async function pollActiveJob() {
  if (!activeJob || jobPollInFlight) return;
  jobPollInFlight = true;
  try {
    const res = await fetch(`/api/job?id=${encodeURIComponent(activeJob.jobId)}`, {
      headers: buildVisitorHeaders(),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.visitorToken) storeVisitorToken(data.visitorToken);
    if (!data.ok || !data.job) return;

    const job = data.job;
    if (job.status === "done") {
      stopJobTracking();
      sculptBtn.disabled = false;
      if (data.world) {
        worldData = data.world;
        engine.applyWorldSnapshot(worldData);
        missionSystem?.setWorldData(worldData);
      }
      if (data.feeds) {
        engine.applyLiveFeeds(data.feeds);
      }
      myCreationId = job.creationId || data.world?.myCreationId || myCreationId;
      readyCreation =
        job.creation || worldData?.creations?.find((c) => c.id === myCreationId) || null;
      uiState = "ready";
      syncDockUI();
      return;
    }

    if (job.status === "failed") {
      stopJobTracking();
      sculptBtn.disabled = false;
      if (job.creationId) {
        myCreationId = job.creationId;
        uiState = "placed";
        syncDockUI();
        return;
      }
      uiState = "composing";
      syncDockUI();
      showFormError(job.error || "Could not build that right now — try again.");
      return;
    }

    activeJob = { ...job };
    renderActiveJobLabel();
  } catch {
    // ignore transient poll hiccups; next tick or WS broadcast will recover
  } finally {
    jobPollInFlight = false;
  }
}

function startTrackingJob(jobInfo) {
  stopJobTracking();
  activeJob = { ...jobInfo };
  uiState = "building";
  syncDockUI();

  jobPollInterval = setInterval(() => {
    if (uiState === "building" && activeJob) {
      pollActiveJob();
    }
  }, 2500);
}

// Dynamically resize the 3D staked plot on the island as the visitor describes tiny vs colossal subjects!
promptInput.addEventListener("input", () => {
  engine.setPreviewPrompt(promptInput.value);
});

// 1. Click "+ Add" -> pick where on the island it will go
addBtn.addEventListener("click", () => {
  if (engine.isFirstPerson()) {
    engine.setDragMode("pan");
  }
  if (myCreationId) {
    uiState = "placed";
    syncDockUI();
    return;
  }
  hoverCard.hidden = true;
  engine.setPreviewPrompt(promptInput.value);
  uiState = "picking";
  syncDockUI();
});

cancelPickBtn.addEventListener("click", () => {
  chosenSpot = null;
  uiState = "idle";
  syncDockUI();
});

moveSpotBtn.addEventListener("click", () => {
  uiState = "picking";
  syncDockUI();
});

closeBuilderBtn.addEventListener("click", () => {
  hideError();
  chosenSpot = null;
  uiState = "idle";
  syncDockUI();
});

window.addEventListener("keydown", (e) => {
  const isRacing = Boolean(engine?.getRaceStatus?.()?.active);

  if (e.key === "Escape") {
    if (
      characterBuilder?.isOpen?.() ||
      (avatarDialog &&
        (avatarDialog.open || (e.target instanceof Node && avatarDialog.contains(e.target)))) ||
      performance.now() - lastAvatarDialogCloseMs < 80
    ) {
      return;
    }
    if (bballHud && !bballHud.hidden) {
      e.preventDefault();
      closeBasketballHud();
      return;
    }
    if (npcDialogCard && !npcDialogCard.hidden) {
      e.preventDefault();
      closeNpcDialog();
      return;
    }
    if (isRacing) {
      e.preventDefault();
      engine?.exitCarRace?.({ enterWalk: true });
      return;
    }
    if (opsDrawerOpen) {
      e.preventDefault();
      closeOpsDrawer();
      return;
    }
    if (uiState === "picking" || uiState === "composing") {
      e.preventDefault();
      hideError();
      chosenSpot = null;
      uiState = "idle";
      syncDockUI();
    } else if (engine.isFirstPerson()) {
      e.preventDefault();
      hoverCard.hidden = true;
      engine.setDragMode("pan");
    }
    return;
  }

  if (
    !isOgCapture &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    !e.repeat &&
    !isEditableElementFocused(e.target) &&
    !isEditableElementFocused(document.activeElement) &&
    !characterBuilder?.isOpen?.() &&
    !avatarDialog?.open
  ) {
    if (e.code === "Space" && bballHud && !bballHud.hidden) {
      e.preventDefault();
      shootBasketballNow();
      return;
    }
    const k = e.key.toLowerCase();
    if (isRacing) {
      if (k === "r") {
        e.preventDefault();
        engine?.respawnRaceCar?.();
      } else if (k === "c") {
        e.preventDefault();
        engine?.toggleRaceCam?.();
      }
      return;
    }
    if (k === "n") {
      e.preventDefault();
      if (opsDrawerOpen && opsActiveTab === "map") {
        closeOpsDrawer();
      } else {
        openOpsDrawer("map");
      }
    } else if (k === "m") {
      e.preventDefault();
      if (opsDrawerOpen && opsActiveTab === "missions") {
        closeOpsDrawer();
      } else {
        openOpsDrawer("missions");
      }
    } else if (k === "r") {
      e.preventDefault();
      if (opsDrawerOpen && opsActiveTab === "radio") {
        closeOpsDrawer();
      } else {
        openOpsDrawer("radio");
      }
    } else if (k === "h") {
      e.preventDefault();
      startStoreOrBankRobbery();
    } else if (k === "v") {
      e.preventDefault();
      void voiceChatCtrl?.startPushToTalk?.();
    }
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "KeyV" || e.key?.toLowerCase() === "v") {
    voiceChatCtrl?.stopPushToTalk?.();
  }
});

window.addEventListener("blur", () => {
  voiceChatCtrl?.stopPushToTalk?.();
});

worldCanvas.addEventListener("pointerleave", () => {
  hoverCard.hidden = true;
});

readyGotoBtn.addEventListener("click", () => {
  if (!myCreationId) return;
  hoverCard.hidden = true;
  uiState = "placed";
  syncDockUI();
  engine.focusCreationById(myCreationId);
  const mine = worldData?.creations?.find((c) => c.id === myCreationId) || readyCreation;
  if (mine) {
    const desc = mine.description || mine.behavior?.statusLine || "";
    showToast(desc ? `${mine.name} — ${desc}` : mine.name, 4600);
  }
});

locateMineBtn.addEventListener("click", () => {
  if (!myCreationId) return;
  hoverCard.hidden = true;
  engine.focusCreationById(myCreationId);
  const mine = worldData?.creations?.find((c) => c.id === myCreationId);
  if (mine) {
    const desc = mine.description || mine.behavior?.statusLine || "";
    showToast(desc ? `${mine.name} — ${desc}` : mine.name);
  }
});

async function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Unsupported image format"));
      img.onload = () => {
        const maxSide = 960;
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          if (width >= height) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          } else {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }
        }
        const c = document.createElement("canvas");
        c.width = Math.max(1, width);
        c.height = Math.max(1, height);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.86));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function showFormError(msg) {
  formError.textContent = msg;
  formError.hidden = false;
}

function hideError() {
  formError.hidden = true;
}

async function handleSelectedFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    showFormError("Choose a PNG, JPG, or WebP image.");
    return;
  }
  hideError();
  try {
    selectedImageDataUrl = await resizeImageFile(file);
    dropPreviewImg.src = selectedImageDataUrl;
    dropEmpty.hidden = true;
    dropPreviewWrap.hidden = false;
  } catch (err) {
    showFormError(err.message || "Could not process that image.");
  }
}

imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  if (file) handleSelectedFile(file);
});

clearImageBtn.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  selectedImageDataUrl = null;
  imageInput.value = "";
  dropPreviewImg.removeAttribute("src");
  dropPreviewWrap.hidden = true;
  dropEmpty.hidden = false;
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer?.files?.[0];
  if (file) handleSelectedFile(file);
});

window.addEventListener("paste", (e) => {
  if (uiState !== "composing") return;
  const items = e.clipboardData?.items || [];
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const f = item.getAsFile();
      if (f) handleSelectedFile(f);
      break;
    }
  }
});

// Enqueue build into the multi-user workshop queue -> close builder immediately so visitor can explore while watching live build stages!
sculptBtn.addEventListener("click", async () => {
  if (uiState === "building") return;
  hideError();
  const prompt = promptInput.value.trim();
  if (!prompt && !selectedImageDataUrl) {
    showFormError("Add a photo or short description first.");
    return;
  }

  engine.setPreviewPrompt(prompt);
  const spotX = chosenSpot?.x ?? null;
  const spotZ = chosenSpot?.z ?? null;

  uiState = "building";
  sculptBtn.disabled = true;
  buildingPillLabel.textContent = "Approving query…";
  if (buildingPillSub) {
    buildingPillSub.textContent = "Being built with Gemini 4 Hydrogen";
  }
  syncDockUI();

  try {
    const res = await fetch("/api/build", {
      method: "POST",
      headers: buildVisitorHeaders({
        "content-type": "application/json",
        "x-meadow-client": "1",
      }),
      body: JSON.stringify({
        prompt,
        imageDataUrl: selectedImageDataUrl || undefined,
        x: spotX,
        z: spotZ,
      }),
    });
    const data = await res.json();
    if (data?.visitorToken) storeVisitorToken(data.visitorToken);

    if (!res.ok || !data.ok) {
      sculptBtn.disabled = false;
      if (data.alreadyPlaced && data.myCreationId) {
        myCreationId = data.myCreationId;
        uiState = "placed";
        syncDockUI();
        return;
      }
      uiState = "composing";
      syncDockUI();
      showFormError(data.error || "Could not build that right now — try again.");
      return;
    }

    if (data.job) {
      startTrackingJob(data.job);
      return;
    }

    // Direct synchronous fallback if ever returned
    sculptBtn.disabled = false;
    worldData = data.world;
    myCreationId = data.creation.id;
    readyCreation = data.creation;
    if (data.feeds) engine.applyLiveFeeds(data.feeds);
    engine.applyWorldSnapshot(worldData);
    uiState = "ready";
    syncDockUI();
  } catch {
    sculptBtn.disabled = false;
    uiState = "composing";
    syncDockUI();
    showFormError("Network hiccup while building — try again.");
  }
});

promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sculptBtn.click();
  }
});

async function refreshLiveFeeds() {
  try {
    const res = await fetch("/api/feeds");
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok && data.feeds) {
      engine.applyLiveFeeds(data.feeds);
    }
  } catch {
    // ignore transient feed errors
  }
}

async function refreshDailyEligibility() {
  if (isOgCapture || uiState === "building" || uiState === "ready") return;
  try {
    const res = await fetch("/api/world", {
      headers: buildVisitorHeaders(),
    });
    if (!res.ok) return;
    const latest = await res.json();
    if (latest?.visitorToken) storeVisitorToken(latest.visitorToken);
    worldData = latest;
    myCreationId = latest.myCreationId || null;
    engine.applyWorldSnapshot(worldData);
    missionSystem?.setWorldData(worldData);
    if (latest.myActiveJob && !myCreationId) {
      startTrackingJob(latest.myActiveJob);
    } else if (!myCreationId && uiState === "placed") {
      uiState = "idle";
      syncDockUI();
    }
  } catch {
    // ignore transient network errors
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (uiState === "building" && activeJob) {
      pollActiveJob();
    } else {
      refreshDailyEligibility();
    }
  }
});

function handleWorldMessage(msg) {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "queue_tick" && activeJob && uiState === "building") {
    const qIdx = Array.isArray(msg.queuedIds) ? msg.queuedIds.indexOf(activeJob.jobId) : -1;
    const activeEntry = Array.isArray(msg.sculpting)
      ? msg.sculpting.find((s) => s.jobId === activeJob.jobId)
      : null;
    if (qIdx >= 0) {
      activeJob.status = "queued";
      activeJob.phase = "queued";
      activeJob.position = qIdx + 1;
      renderActiveJobLabel();
    } else if (activeEntry) {
      activeJob.status = "sculpting";
      if (activeEntry.phase) {
        activeJob.phase = activeEntry.phase;
      } else if (activeJob.phase === "queued") {
        activeJob.phase = "sculpting";
      }
      activeJob.position = 0;
      renderActiveJobLabel();
    }
    pollActiveJob();
    return;
  }

  if ((msg.type === "creation_placed" || msg.type === "world_updated") && msg.world) {
    worldData = {
      ...msg.world,
      myCreationId,
    };
    engine.applyWorldSnapshot(worldData);
    missionSystem?.setWorldData(worldData);
    if (opsDrawerOpen && opsActiveTab === "cities") {
      renderCitiesPanel();
    }
    if (uiState === "building" && activeJob) {
      pollActiveJob();
    } else if (uiState === "placed" || uiState === "ready") {
      syncDockUI();
    }
    refreshLiveFeeds();

    if (
      msg.type === "creation_placed" &&
      msg.creation &&
      msg.creation.id !== myCreationId &&
      uiState !== "building"
    ) {
      showToast(`Someone added "${msg.creation.name}" to GeminIsland!`, 4200);
    }
  }
}

if (!isOgCapture) {
  mpClient = createMultiplayerClient({
    multiplayerEnabled: !isOgCapture,
    getLocalPose: () => engine?.getLocalMultiplayerPose?.(),
    getLocalProfile: () => ({
      ...(engine?.getLocalAppearance?.() || {}),
      voice: localPlayerVoice,
    }),
    getExtraHeaders: () => buildVisitorHeaders(),
    onWorldMessage: handleWorldMessage,
    onWelcome(msg) {
      mpConnected = true;
      mpPeers.clear();
      if (Array.isArray(msg?.players)) {
        for (const p of msg.players) {
          upsertMpPeerRecord(p);
        }
      }
      engine?.syncMultiplayerWelcome?.(msg?.players || []);
      void voiceChatCtrl?.syncPeers?.(Array.from(mpPeers.keys()));
      if (typeof msg?.onlineCount === "number") {
        updateOnlinePill(msg.onlineCount);
      } else {
        syncMpStatusSummary();
      }
      if (opsDrawerOpen && opsActiveTab === "players") {
        renderPlayersPanel();
      }
      if (Array.isArray(msg?.chatHistory)) {
        seedRadioHistory(msg.chatHistory);
      }
    },
    onPeerJoin(player, msg) {
      mpConnected = true;
      upsertMpPeerRecord(player);
      engine?.upsertRemotePlayer?.(player);
      void voiceChatCtrl?.syncPeers?.(Array.from(mpPeers.keys()));
      if (typeof msg?.onlineCount === "number") {
        updateOnlinePill(msg.onlineCount);
      }
      if (opsDrawerOpen && opsActiveTab === "players") {
        renderPlayersPanel();
      }
      const peerName = player?.name || "An explorer";
      showToast(`${peerName} joined GeminIsland!`, 3000);
      soundEngine?.playChatPing?.({ isDispatch: false, pan: 0, gain: 0.7 });
      if (mpVoiceChatCheckbox?.checked && voiceNarrator?.getState?.().enabled) {
        void voiceNarrator.speak(`${peerName} joined the island.`, {
          persona: "player",
          voiceName: player?.voice || "Puck",
          speakerLabel: peerName,
        });
      }
    },
    onPeerPose(poseMsg) {
      upsertMpPeerRecord(poseMsg);
      engine?.updateRemotePlayerPose?.(poseMsg);
    },
    onPeerProfile(profileMsg) {
      upsertMpPeerRecord(profileMsg);
      engine?.updateRemotePlayerProfile?.(profileMsg);
      if (opsDrawerOpen && opsActiveTab === "players") {
        renderPlayersPanel();
      }
    },
    onPeerEmote(emoteMsg) {
      engine?.triggerRemotePlayerEmote?.(emoteMsg);
      const peer = emoteMsg?.id ? mpPeers.get(emoteMsg.id) : null;
      const aState = engine?.getAudioWorldState?.();
      const mix = computeSpatialAudioMix(
        aState ? { x: aState.playerX, z: aState.playerZ, yaw: aState.playerYaw, room: aState.roomId } : null,
        peer,
      );
      soundEngine?.playEmoteVoice?.(emoteMsg?.kind || "wave", {
        pan: mix.pan,
        gain: mix.gain,
        voice: peer?.voice || "Puck",
      });
    },
    onChatMessage(chatMsg) {
      appendRadioMessage(chatMsg);
      const selfId = mpClient?.getSelfId?.();
      const isRemote = chatMsg && chatMsg.senderId !== selfId;
      const peer = chatMsg?.senderId ? mpPeers.get(chatMsg.senderId) : null;
      const aState = engine?.getAudioWorldState?.();
      const mix = computeSpatialAudioMix(
        aState ? { x: aState.playerX, z: aState.playerZ, yaw: aState.playerYaw, room: aState.roomId } : null,
        peer,
      );
      if (isRemote) {
        soundEngine?.playChatPing?.({
          isDispatch: chatMsg.senderKind === "dispatch",
          pan: mix.pan,
          gain: mix.gain,
        });
      }
      if (
        chatMsg &&
        chatMsg.senderKind === "player" &&
        chatMsg.senderId !== selfId &&
        mpVoiceChatCheckbox?.checked &&
        voiceNarrator?.getState?.().enabled
      ) {
        void voiceNarrator.speak(`${chatMsg.senderName || "Explorer"} says: ${chatMsg.text}`, {
          persona: "player",
          voiceName: chatMsg.voice || peer?.voice || "Puck",
          speakerLabel: chatMsg.senderName || "Explorer",
        });
      }
    },
    onVoiceState(vMsg) {
      if (!vMsg?.id) return;
      upsertMpPeerRecord({
        id: vMsg.id,
        speaking: Boolean(vMsg.speaking),
        micActive: Boolean(vMsg.micActive),
        ...(vMsg.voice ? { voice: vMsg.voice } : {}),
      });
      engine?.setPeerVoiceState?.(vMsg.id, {
        speaking: Boolean(vMsg.speaking),
        micActive: Boolean(vMsg.micActive),
        voice: vMsg.voice,
      });
      if (opsDrawerOpen && opsActiveTab === "players") {
        renderPlayersPanel();
      }
    },
    onVoiceClip(clipMsg) {
      if (!clipMsg?.id) return;
      upsertMpPeerRecord({
        id: clipMsg.id,
        x: clipMsg.x,
        z: clipMsg.z,
        room: clipMsg.room ?? null,
        ...(clipMsg.voice ? { voice: clipMsg.voice } : {}),
      });
      voiceChatCtrl?.handleIncomingVoiceClip?.(clipMsg);
    },
    onVoiceSignal(sigMsg) {
      void voiceChatCtrl?.handleVoiceSignal?.(sigMsg);
    },
    onPeerLeave(id, msg) {
      mpPeers.delete(id);
      engine?.removeRemotePlayer?.(id);
      void voiceChatCtrl?.syncPeers?.(Array.from(mpPeers.keys()));
      if (typeof msg?.onlineCount === "number") {
        updateOnlinePill(msg.onlineCount);
      }
      if (opsDrawerOpen && opsActiveTab === "players") {
        renderPlayersPanel();
      }
    },
    onOnlineCountChange(count) {
      updateOnlinePill(count);
    },
  });
}

syncWeatherBarUI(engine?.getWeatherState?.());
syncMpStatusSummary();

window.__geminIslandMp = mpClient;

async function initWorld() {
  try {
    const res = await fetch("/api/world", {
      headers: buildVisitorHeaders(),
    });
    if (res.ok) {
      worldData = await res.json();
      if (worldData?.visitorToken) storeVisitorToken(worldData.visitorToken);
      myCreationId = worldData.myCreationId || myCreationId || null;
      engine.applyWorldSnapshot(worldData);
      missionSystem?.setWorldData(worldData);
      refreshNavigationAndMaps({ forceSteps: true });
      if (opsDrawerOpen && opsActiveTab === "cities") {
        renderCitiesPanel();
      }
      if (!isOgCapture) {
        if (myCreationId) {
          uiState = "placed";
          syncDockUI();
        } else if (worldData.myActiveJob) {
          startTrackingJob(worldData.myActiveJob);
        } else {
          uiState = "idle";
          syncDockUI();
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch initial world:", err);
  }

  refreshLiveFeeds();
  if (!isOgCapture) {
    void fetchRaceLeaderboard();
    setInterval(refreshLiveFeeds, 90_000);
    setInterval(refreshDailyEligibility, 10 * 60_000);
  }
}

initWorld();

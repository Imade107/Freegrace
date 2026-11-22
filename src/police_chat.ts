import {
  callGeminiWithFallbacks,
  createGeminiSdkClient,
  extractJsonObject,
  isHydrogenModel,
} from "./gemini_models";
import { redactSecrets, safeLogWarn, sanitizePlainText } from "./security";
import type { TrafficIncidentRecord, WorldCreation } from "./types";

const FAST_DISPATCH_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
  "gemini-3.8-flash",
  "hydrogen-l",
] as const;

let cachedDispatchModel: string | null = null;
const skipThinkingDispatchModels = new Set<string>();

async function generateFastDispatchJson(opts: {
  apiKey: string;
  systemPrompt: string;
  userText: string;
}): Promise<{ json: Record<string, unknown>; modelUsed: string } | null> {
  const ai = createGeminiSdkClient(opts.apiKey);
  const startMs = Date.now();
  const order = cachedDispatchModel
    ? [cachedDispatchModel, ...FAST_DISPATCH_MODELS.filter((m) => m !== cachedDispatchModel)]
    : [...FAST_DISPATCH_MODELS];

  for (const model of order) {
    if (Date.now() - startMs > 10_000) break;
    const isModernNoBudget = /^gemini-(?:4|3\.8)/i.test(model);
    const hydrogen = isHydrogenModel(model);
    const tryConfig = async (withThinking: boolean): Promise<Record<string, unknown> | null> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3_500);
      try {
        const config: Record<string, unknown> = {
          systemInstruction: opts.systemPrompt,
          maxOutputTokens: hydrogen ? 2048 : 500,
          responseMimeType: "application/json",
          abortSignal: controller.signal,
        };
        if (!isModernNoBudget && !hydrogen) {
          config.temperature = 0.45;
          if (withThinking && !skipThinkingDispatchModels.has(model)) {
            config.thinkingConfig = /^gemini-3/i.test(model)
              ? { thinkingLevel: "MINIMAL" }
              : { thinkingBudget: 0 };
          }
        }
        const response = await ai.models.generateContent({
          model,
          contents: opts.userText,
          config,
        });
        clearTimeout(timer);

        const parts = response?.candidates?.[0]?.content?.parts ?? [];
        let nonThought = "";
        let all = "";
        for (const p of parts) {
          if (typeof p.text === "string") {
            all += p.text;
            if (!p.thought) nonThought += p.text;
          }
        }
        const rawText = nonThought.trim() || all.trim() || (response.text ?? "").trim();
        const json = extractJsonObject(rawText);
        if (typeof json.reply === "string" && json.reply.trim()) {
          return json;
        }
        return null;
      } catch (err) {
        clearTimeout(timer);
        const msg = err instanceof Error ? err.message : String(err);
        if (/API_KEY_INVALID|API key not valid|invalid api key/i.test(msg)) {
          throw err;
        }
        if (withThinking && /\b400\b/.test(msg) && /thinking|budget|level/i.test(msg)) {
          skipThinkingDispatchModels.add(model);
          return tryConfig(false);
        }
        return null;
      }
    };

    const json = await tryConfig(true);
    if (json) {
      cachedDispatchModel = model;
      return { json, modelUsed: model };
    }
  }
  return null;
}

export interface PoliceChatHistoryTurn {
  role: "player" | "dispatch";
  name: string;
  text: string;
}

export interface PoliceActiveMissionContext {
  title?: string;
  phase?: "to_pickup" | "to_dropoff";
  cargo?: string;
  pickupName?: string;
  dropoffName?: string;
  distanceMeters?: number;
}

export interface PoliceDispatchMissionSuggestion {
  title: string;
  cargo: string;
  urgency: "standard" | "priority" | "express";
  pickupId: string;
  pickupName: string;
  pickupX: number;
  pickupZ: number;
  dropoffId: string;
  dropoffName: string;
  dropoffX: number;
  dropoffZ: number;
  timeLimitSec: number;
  rewardCredits: number;
  brief: string;
}

export interface PoliceDispatchReply {
  reply: string;
  unitCode: string;
  dispatchMission: PoliceDispatchMissionSuggestion | null;
  modelUsed: string;
}

function selectDispatchLandmarks(creations: readonly WorldCreation[]): WorldCreation[] {
  const candidates = creations.filter(
    (c) =>
      !c.isCompanion &&
      (c.category === "building" || c.behavior?.type === "landmark") &&
      typeof c.x === "number" &&
      typeof c.z === "number",
  );
  // Prioritize named civic/shop/food/station hubs first, capped so prompt remains tight and fast.
  const priorityRe = /police|safety|hospital|station|bakery|bookshop|ramen|pizza|gelateria|library|ranger|quarry|observatory|school|harbor/i;
  const prioritized = candidates.filter((c) => priorityRe.test(c.name));
  const others = candidates.filter((c) => !priorityRe.test(c.name));
  return [...prioritized, ...others].slice(0, 26);
}

function resolveLandmarkPair(
  landmarks: readonly WorldCreation[],
  pickupIdRaw: unknown,
  dropoffIdRaw: unknown,
  playerPos?: { x: number; z: number } | null,
): { pickup: WorldCreation; dropoff: WorldCreation } | null {
  if (landmarks.length < 2) return null;

  const findByIdOrName = (raw: unknown): WorldCreation | undefined => {
    const token = sanitizePlainText(raw, 80, true).toLowerCase();
    if (!token) return undefined;
    return (
      landmarks.find((c) => c.id.toLowerCase() === token) ||
      landmarks.find((c) => c.name.toLowerCase() === token) ||
      landmarks.find((c) => c.name.toLowerCase().includes(token))
    );
  };

  let pickup = findByIdOrName(pickupIdRaw);
  let dropoff = findByIdOrName(dropoffIdRaw);

  if (!pickup) {
    if (playerPos && Number.isFinite(playerPos.x) && Number.isFinite(playerPos.z)) {
      const sorted = [...landmarks].sort(
        (a, b) =>
          Math.hypot(a.x - playerPos.x, a.z - playerPos.z) -
          Math.hypot(b.x - playerPos.x, b.z - playerPos.z),
      );
      pickup = sorted[Math.min(1, sorted.length - 1)] || sorted[0];
    } else {
      pickup = landmarks[0];
    }
  }

  if (!dropoff || dropoff.id === pickup.id) {
    const others = landmarks.filter((c) => c.id !== pickup.id);
    const farChoices = others.filter((c) => {
      const d = Math.hypot(c.x - pickup!.x, c.z - pickup!.z);
      return d >= 38 && d <= 170;
    });
    const pool = farChoices.length > 0 ? farChoices : others;
    dropoff = pool[Math.floor(Math.random() * pool.length)];
  }

  if (!pickup || !dropoff || pickup.id === dropoff.id) return null;
  return { pickup, dropoff };
}

export async function generatePoliceDispatchReply(opts: {
  apiKey: string;
  hydrogenModel?: string;
  hydrogenModels?: string | readonly string[];
  primaryModel?: string;
  fallbackModel?: string;
  playerMessage: string;
  playerName?: string;
  playerPos?: { x: number; z: number } | null;
  activeMission?: PoliceActiveMissionContext | null;
  history?: readonly PoliceChatHistoryTurn[];
  creations: readonly WorldCreation[];
  trafficIncidents: readonly TrafficIncidentRecord[];
}): Promise<PoliceDispatchReply> {
  const landmarks = selectDispatchLandmarks(opts.creations);
  const landmarkIndexText = landmarks
    .map(
      (c) =>
        `- ${c.id} | "${c.name}" @ (${Math.round(c.x)}, ${Math.round(c.z)})${c.description ? ` — ${c.description.slice(0, 72)}` : ""}`,
    )
    .join("\n");

  const incidentsText =
    opts.trafficIncidents.length > 0
      ? opts.trafficIncidents
          .slice(0, 6)
          .map(
            (inc) =>
              `- Vehicle ${inc.vehicleId} reported ${inc.reason} near (${Math.round(inc.x)}, ${Math.round(inc.z)}) [reports: ${inc.count}]`,
          )
          .join("\n")
      : "No active vehicle gridlocks; avenues and ring roads are clear.";

  const activeMissionText = opts.activeMission
    ? `Active courier mission: "${opts.activeMission.title || "Parcel Run"}" | Phase: ${opts.activeMission.phase || "to_pickup"} | Cargo: ${opts.activeMission.cargo || "Parcel"} | From: ${opts.activeMission.pickupName || "?"} -> To: ${opts.activeMission.dropoffName || "?"}${typeof opts.activeMission.distanceMeters === "number" ? ` | ~${Math.round(opts.activeMission.distanceMeters)}m remaining` : ""}`
    : "No active courier mission assigned yet.";

  const recentHistoryText = (opts.history ?? [])
    .slice(-8)
    .map((h) => `${h.role === "dispatch" ? "DISPATCH" : h.name || "OFFICER"}: ${h.text}`)
    .join("\n");

  const posText =
    opts.playerPos && Number.isFinite(opts.playerPos.x) && Number.isFinite(opts.playerPos.z)
      ? `(${Math.round(opts.playerPos.x)}, ${Math.round(opts.playerPos.z)})`
      : "central meadow";

  const systemPrompt = `You are Officer Sunny, the friendly, sharp Police & Courier Radio Dispatcher (Unit 04) on GeminIsland—a sunny shared 3D voxel island town with 6 neighborhoods (Central Town Square, Westmeadow Harbor, North Tech Spaceport, Quarryside Springs, Southside Beacon, Suncoast East Circuit), shops, delivery routes, and the Island Grand Prix car race along the outer ring road.
You help patrol units, racers, and delivery couriers over the island police radio with crisp radio cadence ("10-4", "Copy that", "Signal clear"), real GeminIsland landmark directions, island traffic updates, and fun delivery dispatches.

Rules:
- Keep "reply" concise (1-3 short, vivid sentences, max 260 characters), warm, family-friendly, and grounded in REAL GeminIsland landmarks from the directory below.
- Never invent landmarks or coordinates not listed below.
- If the user asks for a mission, delivery, job, patrol task, supplies, or help finding something to do—or says things like "need a run", "send mission", "any deliveries?", "where should I go?"—include a "dispatchMission" object using two DIFFERENT real landmark IDs from the directory!
- Otherwise, set "dispatchMission" to null.
- Return ONLY a single valid JSON object matching this exact shape:
{
  "reply": "string (1-3 sentences, max 260 chars)",
  "unitCode": "string (short radio code like '10-4 · Unit 04' or 'Priority · Dispatch')",
  "dispatchMission": null | {
    "title": "short 2-5 word mission title",
    "cargo": "short 2-4 word cargo name (e.g. 'First-Aid Kit', 'Hot Ramen Bowl', 'Warm Sourdough', 'Safety Beacon')",
    "urgency": "standard" | "priority" | "express",
    "pickupId": "exact landmark id from directory",
    "dropoffId": "different exact landmark id from directory",
    "timeLimitSec": integer between 90 and 220,
    "brief": "short 1-sentence courier instruction"
  }
}`;

  const userText = [
    `CALLER: ${opts.playerName || "Patrol Unit"} at position ${posText}`,
    activeMissionText,
    `TRAFFIC & SAFETY LOG:\n${incidentsText}`,
    `ISLAND LANDMARKS:\n${landmarkIndexText}`,
    recentHistoryText ? `RECENT RADIO TRAFFIC:\n${recentHistoryText}` : "",
    `NEW RADIO MESSAGE: "${opts.playerMessage}"`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let result = await generateFastDispatchJson({
    apiKey: opts.apiKey,
    systemPrompt,
    userText,
  });

  if (!result) {
    try {
      result = await callGeminiWithFallbacks({
        apiKey: opts.apiKey,
        mode: "director",
        hydrogenModel: opts.hydrogenModel,
        hydrogenModels: opts.hydrogenModels,
        primaryModel: opts.primaryModel,
        fallbackModel: opts.fallbackModel,
        systemPrompt,
        userText,
        maxOutputTokens: 2048,
        maxCascadeMs: 8_000,
        validateJson: (json) => {
          if (typeof json.reply !== "string" || !json.reply.trim()) {
            return "reply string is required";
          }
          return null;
        },
      });
    } catch (cascadeErr) {
      const msg = redactSecrets(cascadeErr, [opts.apiKey]);
      if (/API_KEY_INVALID|API key not valid|invalid api key/i.test(msg)) {
        throw cascadeErr;
      }
      safeLogWarn("police_chat_cascade_fallback", `Using grounded local dispatch: ${msg.slice(0, 140)}`, [opts.apiKey]);
      const pair = resolveLandmarkPair(landmarks, undefined, undefined, opts.playerPos);
      const wantsMission = /mission|delivery|deliver|run|job|assign|parcel|cargo|help|task|paddock|race/i.test(
        opts.playerMessage,
      );
      const wantsTraffic = /traffic|road|incident|crash|busy|ring/i.test(opts.playerMessage);
      const wantsPlaces = /place|landmark|near|close|where|city|district|shop/i.test(opts.playerMessage);

      let replyText = "10-4, Unit 04 reading you loud and clear across GeminIsland!";
      if (wantsTraffic) {
        replyText =
          opts.trafficIncidents.length > 0
            ? `Caution near (${Math.round(opts.trafficIncidents[0].x)}, ${Math.round(opts.trafficIncidents[0].z)}) — minor congestion logged. Outer Grand Prix ring road is otherwise fast and clear.`
            : "10-4, traffic sensors show smooth flow across Central Square, Westmeadow Harbor, and the Suncoast Grand Prix ring road.";
      } else if (wantsPlaces && pair) {
        replyText = `Copy that! Nearest active hub is ${pair.pickup.name}, with routes stretching toward ${pair.dropoff.name} and Suncoast East Paddock.`;
      } else if (wantsMission && pair) {
        replyText = `Copy ${opts.playerName || "Unit"}! Priority parcel waiting at ${pair.pickup.name} for delivery to ${pair.dropoff.name}. Accept below to roll out!`;
      } else if (pair) {
        replyText = `10-4 ${opts.playerName || "Unit"}! Patrols steady from ${pair.pickup.name} out to ${pair.dropoff.name}. Check the Grand Prix Paddock or ask anytime for a run.`;
      }

      result = {
        modelUsed: "dispatch-relay",
        json: {
          reply: replyText,
          unitCode: wantsMission ? "Priority · Unit 04" : "10-4 · Unit 04",
          dispatchMission:
            wantsMission && pair
              ? {
                  title: "Express Town Relay",
                  cargo: "Priority Dispatch Parcel",
                  urgency: "priority",
                  pickupId: pair.pickup.id,
                  dropoffId: pair.dropoff.id,
                  timeLimitSec: 135,
                  brief: `Pick up parcel at ${pair.pickup.name} and deliver to ${pair.dropoff.name}.`,
                }
              : null,
        },
      };
    }
  }

  const rawReply = sanitizePlainText(result.json.reply, 280, true) || "10-4, loud and clear on Unit 04.";
  const unitCode =
    sanitizePlainText(result.json.unitCode, 32, true) || "10-4 · Unit 04";

  let dispatchMission: PoliceDispatchMissionSuggestion | null = null;
  const rawMission = result.json.dispatchMission;
  if (rawMission && typeof rawMission === "object" && !Array.isArray(rawMission)) {
    const m = rawMission as Record<string, unknown>;
    const pair = resolveLandmarkPair(landmarks, m.pickupId, m.dropoffId, opts.playerPos);
    if (pair) {
      const dist = Math.hypot(pair.dropoff.x - pair.pickup.x, pair.dropoff.z - pair.pickup.z);
      const rawUrgency = sanitizePlainText(m.urgency, 16, true).toLowerCase();
      const urgency: "standard" | "priority" | "express" =
        rawUrgency === "express"
          ? "express"
          : rawUrgency === "priority"
            ? "priority"
            : "standard";
      const rawLimit = typeof m.timeLimitSec === "number" ? Math.round(m.timeLimitSec) : 0;
      const computedLimit = Math.max(
        90,
        Math.min(240, rawLimit || Math.round(75 + dist * 0.85)),
      );
      const bonusBase = urgency === "express" ? 90 : urgency === "priority" ? 70 : 50;
      const rewardCredits = bonusBase + Math.round(dist * 0.35);

      dispatchMission = {
        title: sanitizePlainText(m.title, 48, true) || "Dispatch Supply Run",
        cargo: sanitizePlainText(m.cargo, 36, true) || "Sealed Dispatch Parcel",
        urgency,
        pickupId: pair.pickup.id,
        pickupName: pair.pickup.name,
        pickupX: pair.pickup.x,
        pickupZ: pair.pickup.z,
        dropoffId: pair.dropoff.id,
        dropoffName: pair.dropoff.name,
        dropoffX: pair.dropoff.x,
        dropoffZ: pair.dropoff.z,
        timeLimitSec: computedLimit,
        rewardCredits,
        brief:
          sanitizePlainText(m.brief, 140, true) ||
          `Pick up cargo at ${pair.pickup.name} and deliver to ${pair.dropoff.name}.`,
      };
    }
  }

  return {
    reply: rawReply,
    unitCode,
    dispatchMission,
    modelUsed: result.modelUsed,
  };
}

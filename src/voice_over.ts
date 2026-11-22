import { createGeminiSdkClient } from "./gemini_models";
import { redactSecrets, safeLogWarn } from "./security";

import type { PlayerVoiceName } from "./types";

export type VoiceOverPersona = "gps" | "dispatch" | "villager" | "race" | "player";

export const PLAYER_VOICE_NAMES: readonly PlayerVoiceName[] = [
  "Kore",
  "Puck",
  "Zephyr",
  "Fenrir",
  "Charon",
];

const PLAYER_VOICE_SET = new Set<string>(PLAYER_VOICE_NAMES);

interface PersonaSpec {
  voiceName: PlayerVoiceName;
  style: string;
}

const PERSONA_MAP: Record<VoiceOverPersona, PersonaSpec> = {
  gps: {
    voiceName: "Kore",
    style:
      "Clear, calm, friendly turn-by-turn GPS navigation assistant speaking concisely to a courier.",
  },
  dispatch: {
    voiceName: "Zephyr",
    style:
      "Alert, encouraging island police radio dispatcher Officer Sunny speaking warmly over channel 04.",
  },
  villager: {
    voiceName: "Puck",
    style:
      "Cheerful, warm neighborhood villager greeting a passerby on a sunny island walk.",
  },
  race: {
    voiceName: "Fenrir",
    style:
      "Crisp, energetic motorsports pit-lane race engineer calling out track cues.",
  },
  player: {
    voiceName: "Puck",
    style:
      "Expressive, natural human island explorer speaking cheerfully to fellow players.",
  },
};

const TTS_MODELS = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"] as const;
const MAX_CACHE_ENTRIES = 48;
const CACHE_TTL_MS = 20 * 60_000;
const PER_MODEL_TIMEOUT_MS = 8_500;

interface CachedVoiceEntry {
  audioBase64: string;
  mimeType: string;
  voiceName: string;
  modelUsed: string;
  cachedAt: number;
}

const voiceCache = new Map<string, CachedVoiceEntry>();

export function isValidVoicePersona(raw: unknown): raw is VoiceOverPersona {
  return (
    raw === "gps" ||
    raw === "dispatch" ||
    raw === "villager" ||
    raw === "race" ||
    raw === "player"
  );
}

export function isValidVoiceName(raw: unknown): raw is PlayerVoiceName {
  return typeof raw === "string" && PLAYER_VOICE_SET.has(raw);
}

function buildWavFromPcm16(pcmBytes: Buffer, sampleRate = 24_000, channels = 1): Buffer {
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBytes.byteLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // Linear PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34); // Bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcmBytes.byteLength, 40);
  return Buffer.concat([header, pcmBytes]);
}

function parseSampleRateFromMime(mimeType: string): number {
  const m = /rate=(\d{4,6})/i.exec(mimeType);
  if (!m) return 24_000;
  const hz = Number(m[1]);
  return Number.isFinite(hz) && hz >= 8_000 && hz <= 96_000 ? hz : 24_000;
}

function ensurePlayableWavBase64(
  rawBase64: string,
  rawMimeType: string | undefined,
): { audioBase64: string; mimeType: string } {
  const mime = String(rawMimeType || "audio/wav").trim().toLowerCase();
  const buf = Buffer.from(rawBase64, "base64");
  if (buf.byteLength < 16) {
    throw new Error("Gemini TTS returned an empty audio buffer");
  }
  const hasRiffHeader =
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WAVE";

  if (hasRiffHeader) {
    return { audioBase64: buf.toString("base64"), mimeType: "audio/wav" };
  }

  // Handle standard compressed or raw PCM L16 outputs cleanly
  if (mime.includes("mpeg") || mime.includes("mp3") || mime.includes("ogg") || mime.includes("webm")) {
    return { audioBase64: buf.toString("base64"), mimeType: mime };
  }

  // Raw PCM 16-bit fallback: wrap in 44-byte RIFF header
  const rate = parseSampleRateFromMime(mime);
  const wavBuf = buildWavFromPcm16(buf, rate, 1);
  return { audioBase64: wavBuf.toString("base64"), mimeType: "audio/wav" };
}

function extractInlineAudioPart(
  response: unknown,
): { data: string; mimeType?: string } | null {
  const res = response as {
    candidates?: {
      content?: {
        parts?: {
          inlineData?: { data?: string; mimeType?: string };
        }[];
      };
    }[];
  } | null;

  for (const cand of res?.candidates ?? []) {
    for (const part of cand?.content?.parts ?? []) {
      const data = part?.inlineData?.data;
      if (typeof data === "string" && data.length > 0) {
        return {
          data,
          mimeType: part.inlineData?.mimeType,
        };
      }
    }
  }
  return null;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

export async function generateVoiceOverAudio(opts: {
  apiKey: string;
  text: string;
  persona?: VoiceOverPersona;
  voiceName?: PlayerVoiceName;
}): Promise<{
  audioBase64: string;
  mimeType: string;
  voiceName: string;
  modelUsed: string;
  cached: boolean;
}> {
  const persona: VoiceOverPersona = isValidVoicePersona(opts.persona) ? opts.persona : "gps";
  const spec = PERSONA_MAP[persona];
  const chosenVoice: PlayerVoiceName = isValidVoiceName(opts.voiceName)
    ? opts.voiceName
    : spec.voiceName;
  const cleanText = String(opts.text ?? "").replace(/\s+/g, " ").trim().slice(0, 320);
  if (!cleanText) {
    throw new Error("Voice-over text cannot be empty.");
  }

  const now = Date.now();
  const cacheKey = `${persona}:${chosenVoice}:${cleanText}`;
  const hit = voiceCache.get(cacheKey);
  if (hit && now - hit.cachedAt < CACHE_TTL_MS) {
    // Refresh LRU order
    voiceCache.delete(cacheKey);
    voiceCache.set(cacheKey, hit);
    return {
      audioBase64: hit.audioBase64,
      mimeType: hit.mimeType,
      voiceName: hit.voiceName,
      modelUsed: hit.modelUsed,
      cached: true,
    };
  }

  const ai = createGeminiSdkClient(opts.apiKey);
  const failures: string[] = [];

  for (const model of TTS_MODELS) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: cleanText,
                  speechMetadata: { style: spec.style },
                } as Record<string, unknown>,
              ],
            },
          ],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: chosenVoice,
                },
              },
            },
          },
        }),
        PER_MODEL_TIMEOUT_MS,
        model,
      );

      const audioPart = extractInlineAudioPart(response);
      if (!audioPart) {
        throw new Error(`No inline AUDIO data returned by ${model}`);
      }

      const playable = ensurePlayableWavBase64(audioPart.data, audioPart.mimeType);

      if (voiceCache.size >= MAX_CACHE_ENTRIES) {
        for (const [k, v] of voiceCache.entries()) {
          if (now - v.cachedAt >= CACHE_TTL_MS) voiceCache.delete(k);
        }
        if (voiceCache.size >= MAX_CACHE_ENTRIES) {
          const oldest = voiceCache.keys().next().value;
          if (oldest) voiceCache.delete(oldest);
        }
      }

      voiceCache.set(cacheKey, {
        audioBase64: playable.audioBase64,
        mimeType: playable.mimeType,
        voiceName: chosenVoice,
        modelUsed: model,
        cachedAt: Date.now(),
      });

      return {
        audioBase64: playable.audioBase64,
        mimeType: playable.mimeType,
        voiceName: chosenVoice,
        modelUsed: model,
        cached: false,
      };
    } catch (err) {
      const reason = redactSecrets(err, [opts.apiKey]).slice(0, 160);
      failures.push(`${model}: ${reason}`);
      if (/API_KEY_INVALID|API key not valid|invalid api key/i.test(reason)) {
        break;
      }
    }
  }

  const summary = failures.join(" | ");
  safeLogWarn("voice_over_failed", summary, [opts.apiKey]);
  throw new Error(redactSecrets(`AI voice generation failed (${summary})`, [opts.apiKey]));
}

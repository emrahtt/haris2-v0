/**
 * HARIS v2 — Gemini OCR istemcisi
 *
 * PDF'leri PNG'ye ÇEVİRMEDEN, dosyanın kendisini Gemini'ye gönderir (Gemini
 * uygulamasına dosya yüklemekle aynı yol). Bu sayede yerel PDF→PNG dönüşümünün
 * çöktüğü hafif bozuk / standart dışı PDF'ler de okunabilir.
 *
 * - 14 MB'a kadar inline, üzeri Files API (iş bitince dosya silinir)
 * - Birincil model başarısız olursa yedek modele geçer
 * - Hukuk metinleri (suç, şiddet anlatımı) güvenlik filtresine takılmasın diye filtreler kapalı
 * - Model yeni parametreleri (thinkingLevel, mediaResolution) desteklemiyorsa sade istekle tekrar dener
 */

import { getOcrModels } from "./ocr-config";

const INLINE_LIMIT_BYTES = 14 * 1024 * 1024;
const FILE_POLL_TIMEOUT_MS = 60_000;

const SAFETY_SETTINGS = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
].map((category) => ({ category, threshold: "BLOCK_NONE" }));

export interface GeminiOcrInput {
  data: Buffer;
  mimeType: string;
  prompt: string;
  systemPrompt: string;
  timeoutMs?: number;
}

export interface GeminiOcrResult {
  ok: boolean;
  text: string;
  model?: string;
  truncated?: boolean;
  cost: number;
  error?: string;
}

type FilePart =
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { mimeType: string; fileUri: string } };

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
}

export function hasGeminiKey(): boolean {
  return !!geminiKey();
}

function apiBase(): string {
  return (
    process.env.GEMINI_BASE_URL?.replace(/\/$/, "") ||
    "https://generativelanguage.googleapis.com/v1beta"
  );
}

export async function geminiOcr(input: GeminiOcrInput): Promise<GeminiOcrResult> {
  const apiKey = geminiKey();
  if (!apiKey) {
    return { ok: false, text: "", cost: 0, error: "GEMINI_API_KEY eksik" };
  }

  const { gemini, geminiFallback } = getOcrModels();
  const models = [...new Set([gemini, geminiFallback])];

  let filePart: FilePart;
  let uploadedName: string | null = null;
  try {
    if (input.data.length > INLINE_LIMIT_BYTES) {
      const uploaded = await uploadFile(apiKey, input.data, input.mimeType);
      uploadedName = uploaded.name;
      filePart = { fileData: { mimeType: input.mimeType, fileUri: uploaded.uri } };
    } else {
      filePart = {
        inlineData: { mimeType: input.mimeType, data: input.data.toString("base64") },
      };
    }
  } catch (e) {
    return {
      ok: false,
      text: "",
      cost: 0,
      error: `Gemini dosya yükleme hatası: ${errorMessage(e)}`,
    };
  }

  try {
    const errors: string[] = [];
    for (const model of models) {
      const result = await callModel(apiKey, model, filePart, input);
      if (result.ok) return result;
      errors.push(result.error ?? `${model} başarısız`);
    }
    return { ok: false, text: "", cost: 0, error: errors.join(" | ") };
  } finally {
    if (uploadedName) void deleteFile(apiKey, uploadedName);
  }
}

async function callModel(
  apiKey: string,
  model: string,
  filePart: FilePart,
  input: GeminiOcrInput
): Promise<GeminiOcrResult> {
  let advancedConfig = true;
  let lastError = "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 180_000);
    try {
      const res = await fetch(`${apiBase()}/models/${model}:generateContent`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(buildRequestBody(filePart, input, advancedConfig)),
      });

      if (!res.ok) {
        const body = await res.text();
        lastError = `Gemini ${model} HTTP ${res.status}: ${body.slice(0, 200)}`;
        if (res.status === 400 && advancedConfig) {
          advancedConfig = false;
          attempt--;
          continue;
        }
        if ((res.status === 429 || res.status >= 500) && attempt < 3) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        return fail(lastError);
      }

      const data = (await res.json()) as GeminiResponse;
      const blockReason = data.promptFeedback?.blockReason;
      if (blockReason) return fail(`Gemini ${model} isteği engelledi: ${blockReason}`);

      const candidate = data.candidates?.[0];
      const finishReason = candidate?.finishReason ?? "UNKNOWN";
      const text = (candidate?.content?.parts ?? [])
        .filter((part) => typeof part.text === "string" && !part.thought)
        .map((part) => part.text)
        .join("")
        .trim();

      if (text.length < 5) {
        lastError = `Gemini ${model} boş yanıt (${finishReason})`;
        if (finishReason === "SAFETY" || finishReason === "RECITATION") return fail(lastError);
        if (attempt < 3) {
          await sleep(1000 * attempt);
          continue;
        }
        return fail(lastError);
      }

      const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
      return {
        ok: true,
        text,
        model,
        truncated: finishReason === "MAX_TOKENS",
        cost: (inputTokens * 0.5 + outputTokens * 3) / 1_000_000,
      };
    } catch (e) {
      lastError = `Gemini ${model}: ${errorMessage(e)}`;
      if (attempt < 3) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  return fail(lastError || `Gemini ${model} başarısız`);
}

function buildRequestBody(filePart: FilePart, input: GeminiOcrInput, advanced: boolean) {
  return {
    systemInstruction: { parts: [{ text: input.systemPrompt }] },
    contents: [{ role: "user", parts: [filePart, { text: input.prompt }] }],
    safetySettings: SAFETY_SETTINGS,
    generationConfig: advanced
      ? {
          maxOutputTokens: 65536,
          mediaResolution: "MEDIA_RESOLUTION_HIGH",
          thinkingConfig: { thinkingLevel: "low" },
        }
      : { maxOutputTokens: 32768 },
  };
}

async function uploadFile(
  apiKey: string,
  data: Buffer,
  mimeType: string
): Promise<{ name: string; uri: string }> {
  const uploadBase = apiBase().replace(/\/(v1beta|v1)$/, "/upload/$1");
  const start = await fetch(`${uploadBase}/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(data.length),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: `haris-ocr-${Date.now()}` } }),
  });
  if (!start.ok) throw new Error(`upload start HTTP ${start.status}`);

  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("upload URL alınamadı");

  const upload = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: new Uint8Array(data),
  });
  if (!upload.ok) throw new Error(`upload HTTP ${upload.status}`);

  let file = ((await upload.json()) as { file?: GeminiFile }).file;
  if (!file?.name || !file.uri) throw new Error("upload yanıtı geçersiz");

  const deadline = Date.now() + FILE_POLL_TIMEOUT_MS;
  while (file.state === "PROCESSING" && Date.now() < deadline) {
    await sleep(2000);
    const res = await fetch(`${apiBase()}/${file.name}`, {
      headers: { "x-goog-api-key": apiKey },
    });
    if (!res.ok) break;
    file = (await res.json()) as GeminiFile;
  }
  if (file.state === "FAILED") throw new Error("Gemini dosyayı işleyemedi");
  return { name: file.name!, uri: file.uri! };
}

interface GeminiFile {
  name?: string;
  uri?: string;
  state?: "PROCESSING" | "ACTIVE" | "FAILED";
}

async function deleteFile(apiKey: string, name: string): Promise<void> {
  try {
    await fetch(`${apiBase()}/${name}`, {
      method: "DELETE",
      headers: { "x-goog-api-key": apiKey },
    });
  } catch {
    // Files API dosyaları 48 saat sonra kendiliğinden silinir.
  }
}

function fail(error: string): GeminiOcrResult {
  return { ok: false, text: "", cost: 0, error };
}

function errorMessage(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 200);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

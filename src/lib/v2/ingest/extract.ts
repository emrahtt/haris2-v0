/**
 * HARIS v2 — Belge metin çıkarma (v4)
 *
 * OCR modelleri görsel analiz modelinden AYRIDIR → bkz. ./ocr-config.ts
 *
 * KULLANICI YÖNTEMİ (Faz 13.2):
 *   - "auto"           → pdf-parse (+onarım) kaliteliyse onu kullan, değilse AI zinciri
 *   - "fast"           → pdf-parse / mammoth (AI yok)
 *   - "gemini_vision"  → Gemini, PDF'in KENDİSİNİ okur (PNG'ye çevirmeden)
 *   - "claude_vision"  → Claude native PDF
 *   - "openai_vision"  → PDF → PNG → GPT Vision (sayfa sayfa)
 *   - "best_of_3"      → 3 motor paralel, en iyi çıktı
 *
 * Seçilen motor başarısız olursa diğer motorlara sırayla düşülür. Gemini'nin
 * eksik sayfaları ayrıca tek sayfalık PDF olarak Claude/OpenAI ile yeniden denenir.
 * Sayfa bütünlüğü doğrulanamayan PDF metni başarılı sonuç olarak döndürülmez.
 */

import mammoth from "mammoth";
import { pdfToPng } from "pdf-to-png-converter";
import { readUdf, isUdfFile } from "../udf/reader";
import { getOcrModels, OCR_SYSTEM_PROMPT } from "./ocr-config";
import { geminiOcr, hasGeminiKey } from "./gemini-ocr";
import { readPdfText, assessPdfTextQuality, splitPdf, type PdfChunk } from "./pdf-utils";
import { prepareImage } from "./image-prep";
import { readPdfOcrPages, formatPdfOcrPages } from "./pdf-coverage";

export type ExtractionMethod =
  | "auto"
  | "fast"
  | "claude_vision"
  | "openai_vision"
  | "gemini_vision"
  | "best_of_3";

export interface ExtractResult {
  text: string;
  pageCount?: number;
  method: string;
  modelUsed?: string;
  usedAI: boolean;
  estimatedCost?: number;
  durationMs?: number;
  error?: string;
  incomplete?: boolean;
  userMessage?: string;
  /** Best-of-3 sonucunda hangi modelin kazandığı + diğer skorları */
  comparison?: Array<{ model: string; chars: number; cost: number }>;
}

type Engine = "gemini" | "claude" | "openai";

interface EngineOutcome {
  ok: boolean;
  text: string;
  modelUsed: string;
  cost: number;
  pageCount?: number;
  warning?: string;
  error?: string;
  incomplete?: boolean;
}

const MAX_PDF_SIZE = 30 * 1024 * 1024;
const GEMINI_PAGES_PER_CHUNK = 20;

const ENGINE_LABEL: Record<Engine, string> = {
  gemini: "Gemini",
  claude: "Claude",
  openai: "GPT Vision",
};

const ENGINE_ORDER: Record<ExtractionMethod, Engine[]> = {
  auto: ["gemini", "claude", "openai"],
  fast: ["gemini", "claude", "openai"],
  best_of_3: ["gemini", "claude", "openai"],
  gemini_vision: ["gemini", "claude", "openai"],
  claude_vision: ["claude", "gemini", "openai"],
  openai_vision: ["openai", "gemini", "claude"],
};

// ─────────────────────────────────────────────────────────
// ANA FONKSİYON
// ─────────────────────────────────────────────────────────

export async function extractFromFile(
  filename: string,
  mimeType: string,
  buffer: Buffer,
  method: ExtractionMethod = "auto"
): Promise<ExtractResult> {
  const startTime = Date.now();
  const lower = filename.toLowerCase();

  if (isUdfFile(filename, mimeType)) {
    return extractUdf(buffer, startTime);
  }

  if (
    mimeType.includes("officedocument.wordprocessingml") ||
    lower.endsWith(".docx")
  ) {
    return extractDocx(buffer, startTime);
  }

  if (
    mimeType.startsWith("text/") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md")
  ) {
    return {
      text: buffer.toString("utf-8"),
      method: "txt",
      modelUsed: "UTF-8 decode",
      usedAI: false,
      durationMs: Date.now() - startTime,
    };
  }

  if (mimeType.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|tiff?|bmp|gif)$/.test(lower)) {
    const imageMime = mimeType.startsWith("image/") ? mimeType : guessImageMime(lower);
    return extractImage(buffer, imageMime, method, startTime);
  }

  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    return extractPdf(buffer, method, startTime);
  }

  return {
    text: "",
    method: "fallback",
    usedAI: false,
    durationMs: Date.now() - startTime,
    error: `Desteklenmeyen dosya türü: ${mimeType}`,
    userMessage: `Bu dosya tipi (${mimeType}) henüz desteklenmiyor.`,
  };
}

// ─────────────────────────────────────────────────────────
// PDF
// ─────────────────────────────────────────────────────────

async function extractPdf(
  buffer: Buffer,
  method: ExtractionMethod,
  startTime: number
): Promise<ExtractResult> {
  if (buffer.length > MAX_PDF_SIZE) {
    const sizeMB = (buffer.length / 1024 / 1024).toFixed(1);
    return errorResult(
      startTime,
      `PDF ${sizeMB}MB > 30MB`,
      `📄 PDF çok büyük (${sizeMB} MB). Maksimum 30 MB. Dosyayı bölüp tekrar yükleyin.`
    );
  }

  const parsed = await readPdfText(buffer);
  const pageCount = parsed.pageCount;
  const quality = assessPdfTextQuality(parsed);
  const parserLabel = parsed.repairedBuffer ? "pdf-parse (onarılmış PDF)" : "pdf-parse";

  if (method === "fast") {
    const missing = parsed.pageTexts.flatMap((text, i) => text.trim() ? [] : [i + 1]);
    if (missing.length > 0) {
      return {
        ...errorResult(
          startTime,
          `PDF metin katmanında eksik sayfalar: ${missing.join(", ")}`,
          "PDF'in bazı sayfalarında metin bulunamadı. Eksik metin analize alınmadı; 'Akıllı' veya 'Gemini' yöntemini deneyin."
        ),
        pageCount,
        incomplete: true,
      };
    }
    if (parsed.text.length > 50) {
      return {
        text: parsed.text,
        pageCount,
        method: "pdf_parse_fast",
        modelUsed: `${parserLabel} — AI yok`,
        usedAI: false,
        durationMs: Date.now() - startTime,
        userMessage: quality.usable
          ? undefined
          : `⚠️ Metin kalitesi düşük olabilir (${quality.reason}). Daha iyi sonuç için 'Gemini' yöntemini deneyin.`,
      };
    }
    return {
      ...errorResult(
        startTime,
        "Hızlı modda metin boş",
        "📄 Hızlı modda metin çıkarılamadı (PDF taranmış veya bozuk olabilir). 'Akıllı' veya 'Gemini' yöntemini deneyin."
      ),
      pageCount,
    };
  }

  if (method === "auto" && quality.usable) {
    return {
      text: parsed.text,
      pageCount,
      method: "auto_pdf_parse",
      modelUsed: `Otomatik (${parserLabel} yeterliydi)`,
      usedAI: false,
      durationMs: Date.now() - startTime,
    };
  }

  const rasterSource = parsed.repairedBuffer ?? buffer;
  const runEngine = (engine: Engine) => runPdfEngine(engine, buffer, rasterSource, pageCount);

  if (method === "best_of_3") {
    return pickBestOf3(await runAllEngines(runEngine), pageCount, startTime);
  }

  const result = await runEngineChain(ENGINE_ORDER[method], runEngine, pageCount, startTime);
  if (result.text) return result;

  if (!result.incomplete && quality.usable) {
    return {
      text: parsed.text,
      pageCount,
      method: "pdf_parse_fallback",
      modelUsed: `${parserLabel} (AI okuyamadı)`,
      usedAI: false,
      durationMs: Date.now() - startTime,
      error: result.error,
      userMessage:
        "⚠️ AI modelleri belgeyi okuyamadı; ham PDF metni kullanıldı, hatalı karakterler içerebilir.",
    };
  }
  return {
    ...result,
    pageCount,
    incomplete: result.incomplete || !quality.usable,
  };
}

function runPdfEngine(
  engine: Engine,
  original: Buffer,
  rasterSource: Buffer,
  pageCount: number
): Promise<EngineOutcome> {
  if (engine === "gemini") return pdfWithGemini(original, pageCount);
  if (engine === "claude") return pdfWithClaude(original, pageCount);
  return pdfWithOpenAI(rasterSource, pageCount);
}

async function pdfWithGemini(buffer: Buffer, pageCount: number): Promise<EngineOutcome> {
  if (!hasGeminiKey()) return engineFail("GEMINI_API_KEY eksik");

  const chunks: PdfChunk[] = (await splitPdf(buffer, GEMINI_PAGES_PER_CHUNK)) ?? [
    { data: buffer, startPage: 1, endPage: pageCount },
  ];
  const totalPages = chunks[chunks.length - 1].endPage || pageCount;

  const results = await runWithLimit(
    chunks.map((chunk) => () =>
      geminiOcr({
        data: chunk.data,
        mimeType: "application/pdf",
        systemPrompt: OCR_SYSTEM_PROMPT,
        prompt: pdfChunkPrompt(chunk, chunks.length, totalPages),
      })
    ),
    3
  );

  const pages = new Map<number, string>();
  const models = new Set<string>();
  let cost = results.reduce((sum, r) => sum + r.cost, 0);
  const retries: Array<{ data: Buffer; page: number }> = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const result = results[i];
    const readable = result.ok
      ? readPdfOcrPages(result.text, chunk.startPage, chunk.endPage, result.truncated)
      : new Map<number, string>();
    readable.forEach((text, page) => pages.set(page, text));
    if (readable.size > 0) models.add(`Gemini ${result.model ?? getOcrModels().gemini}`);

    if (readable.size === chunk.endPage - chunk.startPage + 1) continue;
    const singlePages = await splitPdf(chunk.data, 1);
    if (!singlePages || singlePages.length !== chunk.endPage - chunk.startPage + 1) continue;
    for (let j = 0; j < singlePages.length; j++) {
      const page = chunk.startPage + j;
      if (!pages.has(page)) retries.push({ data: singlePages[j].data, page });
    }
  }

  const recovered = await runWithLimit(
    retries.map(({ data, page }) => async () => {
      const claude = await pdfWithClaude(data, 1, page, totalPages);
      if (isUsableOutcome(claude)) return { page, outcome: claude };
      const openai = await pdfWithOpenAI(data, 1, page, totalPages);
      return { page, outcome: { ...openai, cost: claude.cost + openai.cost } };
    }),
    3
  );
  for (const { page, outcome } of recovered) {
    cost += outcome.cost;
    if (!isUsableOutcome(outcome)) continue;
    const text = readPdfOcrPages(outcome.text, page, page).get(page);
    if (text) {
      pages.set(page, text);
      models.add(outcome.modelUsed);
    }
  }

  const missing = Array.from({ length: totalPages }, (_, i) => i + 1).filter((page) => !pages.has(page));
  if (!totalPages || missing.length > 0) {
    return {
      ...engineFail(totalPages
        ? `PDF sayfaları okunamadı: ${missing.join(", ")}`
        : "PDF sayfa sayısı doğrulanamadı"),
      pageCount: totalPages || undefined,
      incomplete: true,
      cost,
    };
  }

  return {
    ok: true,
    text: formatPdfOcrPages(pages),
    pageCount: totalPages,
    modelUsed: `${[...models].join(" + ")} (native PDF${chunks.length > 1 ? `, ${chunks.length} parça` : ""})`,
    cost,
    warning: recovered.some(({ outcome }) => outcome.ok)
      ? "Eksik PDF sayfaları alternatif OCR motorlarıyla tamamlandı."
      : undefined,
  };
}

function pdfChunkPrompt(chunk: PdfChunk, chunkCount: number, totalPages: number): string {
  if (chunkCount === 1) {
    return "Bu PDF belgesinin TÜM sayfalarındaki metni eksiksiz ve birebir çıkar. Her sayfanın başına --- SAYFA N --- yaz.";
  }
  return `Bu PDF, toplam ${totalPages} sayfalık bir belgenin ${chunk.startPage}-${chunk.endPage}. sayfalarıdır. Bu bölümdeki TÜM metni eksiksiz ve birebir çıkar. Sayfa işaretlerini gerçek sayfa numaralarıyla yaz: ilk sayfa --- SAYFA ${chunk.startPage} --- olmalı.`;
}

async function pdfWithClaude(
  buffer: Buffer,
  pageCount: number,
  startPage = 1,
  totalPages = pageCount
): Promise<EngineOutcome> {
  const chunk = { data: buffer, startPage, endPage: startPage + pageCount - 1 };
  const content = [
    {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
    },
    { type: "text", text: pdfChunkPrompt(chunk, startPage === 1 ? 1 : 2, totalPages) },
  ];
  const maxTokens = Math.min(Math.max((pageCount || 5) * 800, 4000), 16000);
  const r = await callClaude(content, maxTokens);
  if (!r.ok) return engineFail(r.error);
  const pages = readPdfOcrPages(r.text, startPage, chunk.endPage, r.truncated);
  if (!pageCount || pages.size !== pageCount) {
    return { ...engineFail("Claude PDF sayfa bütünlüğü doğrulanamadı"), incomplete: true, cost: r.cost };
  }
  return {
    ok: true,
    text: formatPdfOcrPages(pages),
    pageCount,
    modelUsed: `Claude ${r.model} (native PDF)`,
    cost: r.cost,
  };
}

async function pdfWithOpenAI(
  buffer: Buffer,
  expectedPages = 0,
  startPage = 1,
  totalPages = expectedPages
): Promise<EngineOutcome> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return engineFail("OPENAI_API_KEY eksik");

  let pngPages;
  try {
    pngPages = await pdfToPng(buffer, { viewportScale: 2.0, useSystemFonts: false });
  } catch (e) {
    return engineFail(`PDF→PNG dönüşümü başarısız: ${String(e).slice(0, 150)}`);
  }
  if (pngPages.length === 0 || (expectedPages > 0 && pngPages.length !== expectedPages)) {
    return { ...engineFail("PDF→PNG sayfa sayısı uyuşmuyor"), incomplete: true };
  }

  const model = getOcrModels().openai;
  const results = await runWithLimit(
    pngPages.map((page, i) => () =>
      callOpenAIVision(apiKey, model, page.content as Buffer, "image/png", startPage + i, totalPages || pngPages.length)
    ),
    3
  );

  const pages = new Map<number, string>();
  results.forEach((r, i) => {
    const page = startPage + i;
    if (!r.success) return;
    const text = readPdfOcrPages(r.text, page, page).get(page);
    if (text) pages.set(page, text);
  });
  const cost = results.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  if (pages.size !== pngPages.length) {
    const missing = results.flatMap((_, i) => pages.has(startPage + i) ? [] : [startPage + i]);
    return { ...engineFail(`GPT Vision sayfaları okunamadı: ${missing.join(", ")}`), incomplete: true, cost };
  }

  return {
    ok: true,
    text: formatPdfOcrPages(pages),
    pageCount: pngPages.length,
    modelUsed: `GPT ${model} Vision (${pngPages.length} sayfa)`,
    cost,
  };
}

// ─────────────────────────────────────────────────────────
// GÖRSEL (JPG/PNG/WEBP/HEIC...)
// ─────────────────────────────────────────────────────────

async function extractImage(
  buffer: Buffer,
  mimeType: string,
  method: ExtractionMethod,
  startTime: number
): Promise<ExtractResult> {
  const image = await prepareImage(buffer, mimeType);
  const prompt =
    "Bu görseldeki tüm metni eksiksiz ve birebir çıkar. Tablo varsa markdown, damga/imza/kaşe varsa belirt.";

  const runEngine = async (engine: Engine): Promise<EngineOutcome> => {
    if (engine === "gemini") {
      if (!hasGeminiKey()) return engineFail("GEMINI_API_KEY eksik");
      const r = await geminiOcr({
        data: image.data,
        mimeType: image.mimeType,
        systemPrompt: OCR_SYSTEM_PROMPT,
        prompt,
      });
      return r.ok
        ? { ok: true, text: r.text, modelUsed: `Gemini ${r.model}`, cost: r.cost }
        : engineFail(r.error);
    }

    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(image.mimeType)) {
      return engineFail(`${ENGINE_LABEL[engine]} ${image.mimeType} formatını desteklemiyor`);
    }

    if (engine === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return engineFail("OPENAI_API_KEY eksik");
      const model = getOcrModels().openai;
      const r = await callOpenAIVision(apiKey, model, image.data, image.mimeType, 1, 1);
      return r.success
        ? { ok: true, text: r.text, modelUsed: `GPT ${model} Vision`, cost: r.cost ?? 0 }
        : engineFail(r.error);
    }

    const r = await callClaude(
      [
        {
          type: "image",
          source: { type: "base64", media_type: image.mimeType, data: image.data.toString("base64") },
        },
        { type: "text", text: prompt },
      ],
      8000
    );
    return r.ok
      ? { ok: true, text: r.text, modelUsed: `Claude ${r.model} Vision`, cost: r.cost }
      : engineFail(r.error);
  };

  if (method === "best_of_3") {
    return pickBestOf3(await runAllEngines(runEngine), 1, startTime);
  }

  const result = await runEngineChain(ENGINE_ORDER[method], runEngine, 1, startTime);
  return result.text ? { ...result, method: `image_${result.method}` } : result;
}

// ─────────────────────────────────────────────────────────
// MOTOR ZİNCİRİ / BEST-OF-3
// ─────────────────────────────────────────────────────────

async function runEngineChain(
  order: Engine[],
  runEngine: (engine: Engine) => Promise<EngineOutcome>,
  pageCount: number,
  startTime: number
): Promise<ExtractResult> {
  const failures: string[] = [];
  let spent = 0;
  let incomplete = false;

  for (const engine of order) {
    const outcome = await runEngine(engine);
    spent += outcome.cost;
    incomplete ||= outcome.incomplete ?? false;
    if (isUsableOutcome(outcome)) {
      const fellBack =
        engine !== order[0]
          ? `ℹ️ ${ENGINE_LABEL[order[0]]} okuyamadı, ${ENGINE_LABEL[engine]} ile okundu.`
          : undefined;
      return {
        text: outcome.text.trim(),
        pageCount: outcome.pageCount ?? pageCount,
        method: `${engine}_vision`,
        modelUsed: outcome.modelUsed,
        usedAI: true,
        estimatedCost: spent,
        durationMs: Date.now() - startTime,
        userMessage: joinMessages(fellBack, outcome.warning),
      };
    }
    failures.push(`${ENGINE_LABEL[engine]}: ${outcome.error ?? "anlamsız çıktı"}`);
    console.warn(`[OCR] ${ENGINE_LABEL[engine]} başarısız → sonraki motor`, outcome.error);
  }

  return {
    ...errorResult(
      startTime,
      failures.join(" | "),
      incomplete
        ? "PDF'in tüm sayfaları okunamadı. Eksik metin analize alınmadı; belgeyi kontrol edip yeniden yükleyin."
        : `❌ Belge hiçbir modelle okunamadı. ${humanizeError(failures[0])}`
    ),
    estimatedCost: spent,
    incomplete,
    usedAI: spent > 0,
  };
}

async function runAllEngines(
  runEngine: (engine: Engine) => Promise<EngineOutcome>
): Promise<Array<EngineOutcome & { engine: Engine }>> {
  const engines: Engine[] = ["gemini", "claude", "openai"];
  return Promise.all(engines.map(async (engine) => ({ ...(await runEngine(engine)), engine })));
}

function pickBestOf3(
  results: Array<EngineOutcome & { engine: Engine }>,
  pageCount: number,
  startTime: number
): ExtractResult {
  const comparison = results.map((r) => ({
    model: ENGINE_LABEL[r.engine],
    chars: r.text.length,
    cost: r.cost,
  }));
  const totalCost = comparison.reduce((sum, c) => sum + c.cost, 0);
  const valid = results.filter(isUsableOutcome);

  if (valid.length === 0) {
    return {
      ...errorResult(
        startTime,
        results.map((r) => `${ENGINE_LABEL[r.engine]}: ${r.error}`).join(" | "),
        "❌ Hiçbir AI okuyamadı. Dosya çok düşük kalite olabilir."
      ),
      pageCount,
      method: "best_of_3",
      modelUsed: "Best-of-3 (tümü başarısız)",
      estimatedCost: totalCost,
      incomplete: results.some((r) => r.incomplete),
      comparison,
    };
  }

  const best = valid.reduce((a, b) => (b.text.length > a.text.length ? b : a));
  return {
    text: best.text.trim(),
    pageCount: best.pageCount ?? pageCount,
    method: "best_of_3",
    modelUsed: `Best-of-3 → ${best.modelUsed} kazandı`,
    usedAI: true,
    estimatedCost: totalCost,
    durationMs: Date.now() - startTime,
    comparison,
    userMessage: best.warning,
  };
}

// ─────────────────────────────────────────────────────────
// SAĞLAYICI ÇAĞRILARI
// ─────────────────────────────────────────────────────────

async function callClaude(
  content: unknown[],
  maxTokens: number
): Promise<{ ok: true; text: string; model: string; cost: number; truncated: boolean } | { ok: false; error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY eksik" };

  const baseURL =
    process.env.ANTHROPIC_BASE_URL?.replace(/\/$/, "") || "https://api.anthropic.com";
  const model = getOcrModels().claude;
  let lastError = "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 150_000);
    try {
      const res = await fetch(`${baseURL}/v1/messages`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: OCR_SYSTEM_PROMPT,
          messages: [{ role: "user", content }],
        }),
      });

      if (!res.ok) {
        lastError = `Claude HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
        if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        return { ok: false, error: lastError };
      }

      const data = await res.json();
      const text: string = Array.isArray(data.content)
        ? data.content
            .filter((c: { type: string }) => c.type === "text")
            .map((c: { text: string }) => c.text)
            .join("\n")
        : "";
      if (text.trim().length < 5) return { ok: false, error: "Claude boş yanıt" };

      const inputTokens = data.usage?.input_tokens || 0;
      const outputTokens = data.usage?.output_tokens || 0;
      return {
        ok: true,
        text: text.trim(),
        model,
        truncated: data.stop_reason !== "end_turn",
        cost: (inputTokens * 3 + outputTokens * 15) / 1_000_000,
      };
    } catch (e) {
      lastError = `Claude: ${String(e).slice(0, 150)}`;
      if (attempt < 3) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, error: lastError || "Claude başarısız" };
}

async function callOpenAIVision(
  apiKey: string,
  model: string,
  imageBuffer: Buffer,
  mimeType: string,
  pageNum: number,
  totalPages: number
): Promise<{ success: boolean; text: string; cost?: number; error?: string }> {
  const base64 = imageBuffer.toString("base64");
  const usesCompletionTokens = /^(gpt-5|o1|o3|o4)/.test(model);

  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          ...(usesCompletionTokens ? { max_completion_tokens: 8000 } : { max_tokens: 4000 }),
          messages: [
            { role: "system", content: OCR_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Sayfa ${pageNum}/${totalPages}. Bu görseldeki tüm metni birebir çıkar. Tablo, grafik, damga, imza varsa belirt.`,
                },
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
                },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        return {
          success: false,
          text: "",
          error: `GPT HTTP ${res.status}: ${errText.slice(0, 150)}`,
        };
      }

      const data = await res.json();
      const text: string = data.choices?.[0]?.message?.content ?? "";
      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;

      if (!text || text.length < 5 || data.choices?.[0]?.finish_reason !== "stop") {
        return {
          success: false,
          text: "",
          cost: (inputTokens * 2.5 + outputTokens * 10) / 1_000_000,
          error: text.length < 5 ? "Boş yanıt" : "GPT çıktısı tamamlanmadı",
        };
      }
      return {
        success: true,
        text,
        cost: (inputTokens * 2.5 + outputTokens * 10) / 1_000_000,
      };
    } catch (e) {
      if (attempt < 3) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      return { success: false, text: "", error: String(e).slice(0, 100) };
    } finally {
      clearTimeout(timer);
    }
  }
  return { success: false, text: "", error: "Tüm retry'lar tükendi" };
}

// ─────────────────────────────────────────────────────────
// DOCX / UDF
// ─────────────────────────────────────────────────────────

async function extractDocx(buffer: Buffer, startTime: number): Promise<ExtractResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value.trim(),
      method: "docx",
      modelUsed: "Mammoth (Word parse)",
      usedAI: false,
      durationMs: Date.now() - startTime,
    };
  } catch (e) {
    return errorResult(startTime, String(e), "Word açılamadı");
  }
}

async function extractUdf(buffer: Buffer, startTime: number): Promise<ExtractResult> {
  const udf = await readUdf(buffer);
  if (udf.error) {
    return errorResult(startTime, udf.error, "UDF açılamadı");
  }
  let text = udf.text;
  if (udf.metadata.sicilNo || udf.metadata.dogrulamaKodu) {
    text =
      `[UYAP Metadata]\n` +
      (udf.metadata.sicilNo ? `Sicil: ${udf.metadata.sicilNo}\n` : "") +
      (udf.metadata.dogrulamaKodu
        ? `Doğrulama Kodu: ${udf.metadata.dogrulamaKodu}\n`
        : "") +
      (udf.metadata.yazar ? `Yazar: ${udf.metadata.yazar}\n` : "") +
      (udf.hasSignature ? `Durum: E-imzalı\n` : "") +
      `\n---\n\n` +
      text;
  }
  return {
    text,
    method: "udf",
    modelUsed: "Doğrudan UDF parse",
    usedAI: false,
    durationMs: Date.now() - startTime,
  };
}

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

function guessImageMime(lowerFilename: string): string {
  if (/\.jpe?g$/.test(lowerFilename)) return "image/jpeg";
  if (lowerFilename.endsWith(".webp")) return "image/webp";
  if (/\.hei[cf]$/.test(lowerFilename)) return "image/heic";
  if (/\.tiff?$/.test(lowerFilename)) return "image/tiff";
  if (lowerFilename.endsWith(".bmp")) return "image/bmp";
  if (lowerFilename.endsWith(".gif")) return "image/gif";
  return "image/png";
}

function isUsableOutcome(outcome: EngineOutcome): boolean {
  return outcome.ok && !outcome.incomplete &&
    (Boolean(outcome.pageCount) || !looksLikeAIFailure(outcome.text));
}

function looksLikeAIFailure(text: string): boolean {
  if (!text || text.length < 30) return true;
  const lower = text.toLowerCase();
  if (text.length > 1500) return false;
  return (
    /pdf.{0,30}(boş|empty|okunamı|cannot|unable|unsupported|içerik.{0,10}çıkarıla)/i.test(text) ||
    /(belge|dosya).{0,30}(çıkarıla|okunamı|boş.{0,5}görün)/i.test(text) ||
    (lower.includes("dosyayı paylaşabildiğin") && text.length < 600) ||
    (lower.includes("sorry") && text.length < 300)
  );
}

function engineFail(error?: string): EngineOutcome {
  return { ok: false, text: "", modelUsed: "", cost: 0, error: error ?? "bilinmeyen hata" };
}

function joinMessages(...messages: Array<string | undefined>): string | undefined {
  const joined = messages.filter(Boolean).join(" ");
  return joined || undefined;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runWithLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  const queue = tasks.map((task, index) => ({ task, index }));
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      results[item.index] = await item.task();
    }
  });
  await Promise.all(workers);
  return results;
}

function humanizeError(err?: string): string {
  if (!err) return "Bilinmeyen hata";
  if (err.includes("eksik")) return err;
  if (err.includes("fetch failed")) return "İnternet bağlantısı koptu";
  if (err.includes("timeout") || err.includes("aborted"))
    return "İşlem çok uzun sürdü, dosya çok büyük veya karmaşık olabilir";
  if (err.includes("429") || err.includes("rate limit"))
    return "API rate limit — birkaç dakika bekleyin";
  if (err.includes("401") || err.includes("403")) return "API key geçersiz";
  if (err.includes("404")) return "OCR modeli bulunamadı (HARIS_OCR_MODEL ayarını kontrol edin)";
  if (err.includes("503") || err.includes("502")) return "AI sunucusu geçici hizmet dışı";
  return err.slice(0, 150);
}

function errorResult(startTime: number, techError: string, userMsg: string): ExtractResult {
  return {
    text: "",
    method: "fallback",
    usedAI: false,
    durationMs: Date.now() - startTime,
    error: techError,
    userMessage: userMsg,
  };
}

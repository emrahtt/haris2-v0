import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { pdfToPng } from "pdf-to-png-converter";
import { extractFromFile } from "../src/lib/v2/ingest/extract";
import { readPdfText, assessTextQuality, splitPdf } from "../src/lib/v2/ingest/pdf-utils";
import { readPdfOcrPages, formatPdfOcrPages } from "../src/lib/v2/ingest/pdf-coverage";

const originalEnv = { ...process.env };
let unexpectedRequests: string[] = [];
const turkishText = "İstanbul İcra Müdürlüğü: Çığ, ıslak imza, şüpheli, ölçü, güvence; ÇĞİÖŞÜ çğıöşü.";

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-gemini";
  process.env.GOOGLE_API_KEY = "";
  process.env.ANTHROPIC_API_KEY = "test-claude";
  process.env.OPENAI_API_KEY = "test-openai";
  unexpectedRequests = [];
  interceptRequests((url) => {
    unexpectedRequests.push(url);
    return new Response("Real network requests are forbidden", { status: 403 });
  });
});

afterEach(() => {
  mock.restoreAll();
  process.env = { ...originalEnv };
  assert.deepEqual(unexpectedRequests, [], "No unexpected provider request is allowed");
});

async function makePdf(pageCount: number, rawText?: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([180, 240]);
    if (rawText) page.drawText(rawText, { x: 8, y: 180, size: 8, maxWidth: 160 });
  }
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

async function makeScannedPdf(pageCount: number): Promise<Buffer> {
  const images = await pdfToPng(await makePdf(pageCount, "HARIS - Case 123 - Scanned legal exhibit"), {
    viewportScale: 1,
    useSystemFonts: false,
  });
  const doc = await PDFDocument.create();
  for (const image of images) {
    const png = await doc.embedPng(image.content as Buffer);
    doc.addPage([180, 240]).drawImage(png, { x: 0, y: 0, width: 180, height: 240 });
  }
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

function assertPageOrder(text: string, count: number) {
  assert.deepEqual([...text.matchAll(/--- SAYFA (\d+) ---/g)].map((m) => Number(m[1])), Array.from({ length: count }, (_, i) => i + 1));
}

function openaiReply(text: string, finishReason = "stop"): Response {
  return Response.json({
    choices: [{ message: { content: text }, finish_reason: finishReason }],
    usage: { prompt_tokens: 10, completion_tokens: 10 },
  });
}

function requestPage(body: Record<string, unknown>): number {
  const serialized = JSON.stringify(body);
  const match = serialized.match(/Sayfa (\d+)\//) ?? serialized.match(/ilk sayfa --- SAYFA (\d+)/);
  return match ? Number(match[1]) : 1;
}

function pageText(page: number): string {
  return `--- SAYFA ${page} ---\n${turkishText} Sayfa kaydı ${page}.`;
}

function geminiReply(text: string, finishReason = "STOP"): Response {
  return Response.json({
    candidates: [{ content: { parts: [{ text }] }, finishReason }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 },
  });
}

function claudeReply(text: string, stopReason = "end_turn"): Response {
  return Response.json({
    content: [{ type: "text", text }],
    stop_reason: stopReason,
    usage: { input_tokens: 10, output_tokens: 10 },
  });
}

function interceptRequests(handler: (url: string, body: Record<string, unknown>) => Promise<Response> | Response) {
  return mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    assert.ok(init?.body, "Unexpected request without a body; no real network requests are allowed");
    return handler(url, JSON.parse(String(init.body)) as Record<string, unknown>);
  });
}

test("a failed Gemini chunk is retried as just its missing page, in original order", async () => {
  const fallbackPdfSizes: number[] = [];
  interceptRequests(async (url, body) => {
    if (url.includes(":generateContent")) {
      const contents = body.contents as Array<{ parts: Array<{ inlineData?: { data: string } }> }>;
      const data = contents[0].parts.find((part) => part.inlineData)?.inlineData?.data;
      assert.ok(data);
      const chunk = await PDFDocument.load(Buffer.from(data, "base64"));
      return chunk.getPageCount() === 20
        ? geminiReply(Array.from({ length: 20 }, (_, i) => pageText(i + 1)).join("\n\n"))
        : new Response("Chunk failed", { status: 400 });
    }
    if (url.endsWith("/v1/messages")) {
      const messages = body.messages as Array<{ content: Array<{ source?: { data: string }; text?: string }> }>;
      const pdf = messages[0].content.find((part) => part.source)?.source;
      assert.ok(pdf);
      fallbackPdfSizes.push((await PDFDocument.load(Buffer.from(pdf.data, "base64"))).getPageCount());
      return claudeReply(pageText(21));
    }
    throw new Error(`Unexpected provider: ${url}`);
  });

  const result = await extractFromFile("teknik-hukuki.pdf", "application/pdf", await makePdf(21), "gemini_vision");
  assert.deepEqual(fallbackPdfSizes, [1]);
  assert.equal(result.error, undefined);
  assert.equal(result.pageCount, 21);
  assert.deepEqual([...result.text.matchAll(/--- SAYFA (\d+) ---/g)].map((m) => Number(m[1])), Array.from({ length: 21 }, (_, i) => i + 1));
  assert.ok(result.text.includes(turkishText));
  assert.ok(!result.text.includes("OKUNAMADI"));
});

test("an entire failed middle chunk retries every missing page without duplicating successful chunks", async () => {
  const retriedPages: number[] = [];
  const retriedPdfSizes: number[] = [];
  interceptRequests(async (url, body) => {
    if (url.includes(":generateContent")) {
      const serialized = JSON.stringify(body);
      if (serialized.includes("21-40.")) return new Response("Unreadable chunk", { status: 403 });
      if (serialized.includes("41-45.")) return geminiReply([41, 42, 43, 44, 45].map(pageText).join("\n\n"));
      await new Promise((resolve) => setTimeout(resolve, 5));
      return geminiReply(Array.from({ length: 20 }, (_, i) => pageText(i + 1)).join("\n\n"));
    }
    if (url.endsWith("/v1/messages")) {
      const messages = body.messages as Array<{ content: Array<{ source?: { data: string } }> }>;
      const source = messages[0].content.find((part) => part.source)?.source;
      assert.ok(source);
      retriedPdfSizes.push((await PDFDocument.load(Buffer.from(source.data, "base64"))).getPageCount());
      retriedPages.push(requestPage(body));
      return claudeReply(turkishText);
    }
    throw new Error(`Unexpected provider: ${url}`);
  });
  const result = await extractFromFile("large-technical.pdf", "application/pdf", await makePdf(45), "gemini_vision");
  assert.deepEqual(retriedPages.sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 21));
  assert.ok(retriedPdfSizes.every((count) => count === 1));
  assert.equal(result.pageCount, 45);
  assertPageOrder(result.text, 45);
});

test("valid PDF Buffer subarrays remain stable across repeated parser calls without repair", async () => {
  const original = await makePdf(2, "Readable digital legal text. ".repeat(8));
  const padded = Buffer.concat([Buffer.alloc(17), original, Buffer.alloc(19)]);
  const buffer = padded.subarray(17, 17 + original.length);
  const saved = Buffer.from(buffer);
  let previous = "";
  for (let i = 0; i < 3; i++) {
    const parsed = await readPdfText(buffer);
    assert.equal(parsed.pageCount, 2);
    assert.equal(parsed.repairedBuffer, undefined);
    assert.ok(parsed.text.length > 200);
    if (previous) assert.equal(parsed.text, previous);
    previous = parsed.text;
  }
  assert.deepEqual(buffer, saved);
});

test("Claude failure retries the same missing page with real PDF-to-PNG and OpenAI", async () => {
  const openaiPages: number[] = [];
  interceptRequests((url, body) => {
    if (url.includes(":generateContent")) return geminiReply(pageText(1));
    if (url.endsWith("/v1/messages")) return new Response("Unavailable", { status: 403 });
    if (url.endsWith("/chat/completions")) {
      openaiPages.push(requestPage(body));
      assert.match(JSON.stringify(body), /data:image\/png;base64,/);
      return openaiReply(turkishText);
    }
    throw new Error(`Unexpected provider: ${url}`);
  });
  const result = await extractFromFile("scan.pdf", "application/pdf", await makePdf(2), "gemini_vision");
  assert.deepEqual(openaiPages, [2]);
  assertPageOrder(result.text, 2);
  assert.match(result.modelUsed ?? "", /GPT/);
  assert.ok(result.text.includes(turkishText));
  assert.ok((result.estimatedCost ?? 0) > 0);
});

test("successful Gemini responses with a missing middle page retry only that page", async () => {
  const retries: number[] = [];
  interceptRequests((url, body) => {
    if (url.includes(":generateContent")) return geminiReply([pageText(1), pageText(3)].join("\n\n"));
    if (url.endsWith("/v1/messages")) {
      retries.push(requestPage(body));
      return claudeReply(pageText(1));
    }
    throw new Error(`Unexpected provider: ${url}`);
  });
  const result = await extractFromFile("missing-middle.pdf", "application/pdf", await makePdf(3), "gemini_vision");
  assert.deepEqual(retries, [2]);
  assertPageOrder(result.text, 3);
});

for (const finishReason of ["MAX_TOKENS", "SAFETY", "RECITATION"]) {
  test(`Gemini ${finishReason} text is not accepted as a complete chunk`, async () => {
    const retries: number[] = [];
    interceptRequests((url, body) => {
      if (url.includes(":generateContent")) return geminiReply(pageText(1) + "\n" + pageText(2), finishReason);
      if (url.endsWith("/v1/messages")) {
        retries.push(requestPage(body));
        return claudeReply(turkishText);
      }
      throw new Error(`Unexpected provider: ${url}`);
    });
    const result = await extractFromFile("truncated.pdf", "application/pdf", await makePdf(2), "gemini_vision");
    assert.deepEqual(retries.sort(), [1, 2]);
    assertPageOrder(result.text, 2);
  });
}

test("unreadable text markers trigger page recovery, not warning-only success", async () => {
  const retries: number[] = [];
  interceptRequests((url, body) => {
    if (url.includes(":generateContent")) return geminiReply(`${pageText(1)}\n--- SAYFA 2 ---\n[okunamadı]`);
    if (url.endsWith("/v1/messages")) {
      retries.push(requestPage(body));
      return claudeReply(turkishText);
    }
    throw new Error(`Unexpected provider: ${url}`);
  });
  const result = await extractFromFile("unreadable.pdf", "application/pdf", await makePdf(2), "gemini_vision");
  assert.deepEqual(retries, [2]);
  assertPageOrder(result.text, 2);
  assert.ok(!result.text.includes("[okunamadı]"));
});

test("partial text is never returned when all fallback engines fail, including raw parser fallback", async () => {
  const buffer = await makePdf(2, "Readable legal header and docket number. ".repeat(4));
  const raw = await readPdfText(buffer);
  assert.ok(raw.text.length > 50, "Fixture must exercise the raw-text fallback path");
  interceptRequests((url) => url.includes(":generateContent")
    ? geminiReply(pageText(1))
    : new Response("Cannot read page", { status: 403 }));
  const result = await extractFromFile("partial.pdf", "application/pdf", buffer, "gemini_vision");
  assert.equal(result.text, "");
  assert.equal(result.incomplete, true);
  assert.match(result.error ?? "", /2/);
  assert.match(result.userMessage ?? "", /analize alınmadı/);
  assert.equal(result.pageCount, 2);
});

test("best_of_3 does not promote a very long but incomplete document", async () => {
  interceptRequests((url) => {
    if (url.includes(":generateContent")) return geminiReply(`--- SAYFA 1 ---\n${turkishText.repeat(100)}`);
    if (url.endsWith("/v1/messages")) return new Response("Cannot read", { status: 403 });
    return new Response("Cannot read", { status: 403 });
  });
  const result = await extractFromFile("best.pdf", "application/pdf", await makePdf(2), "best_of_3");
  assert.equal(result.text, "");
  assert.equal(result.incomplete, true);
  assert.equal(result.method, "best_of_3");
});

test("a partially failed OpenAI document continues to another engine", async () => {
  interceptRequests((url, body) => {
    if (url.endsWith("/chat/completions")) {
      return requestPage(body) === 2 ? new Response("Unreadable", { status: 403 }) : openaiReply(turkishText);
    }
    if (url.includes(":generateContent")) return geminiReply(pageText(1) + "\n" + pageText(2));
    throw new Error(`Unexpected provider: ${url}`);
  });
  const result = await extractFromFile("openai-partial.pdf", "application/pdf", await makePdf(2), "openai_vision");
  assert.equal(result.method, "gemini_vision");
  assertPageOrder(result.text, 2);
});

test("truncated Claude page responses continue to OpenAI", async () => {
  let openaiCalls = 0;
  interceptRequests((url) => {
    if (url.includes(":generateContent")) return geminiReply(pageText(1));
    if (url.endsWith("/v1/messages")) return claudeReply(turkishText, "max_tokens");
    if (url.endsWith("/chat/completions")) {
      openaiCalls++;
      return openaiReply(turkishText);
    }
    throw new Error(`Unexpected provider: ${url}`);
  });
  const result = await extractFromFile("claude-cut.pdf", "application/pdf", await makePdf(2), "gemini_vision");
  assert.equal(openaiCalls, 1);
  assertPageOrder(result.text, 2);
});

test("truncated OpenAI page responses cannot complete a PDF", async () => {
  interceptRequests((url) => {
    if (url.includes(":generateContent")) return geminiReply(pageText(1));
    if (url.endsWith("/v1/messages")) return new Response("Cannot read", { status: 403 });
    return openaiReply(turkishText, "length");
  });
  const result = await extractFromFile("openai-cut.pdf", "application/pdf", await makePdf(2), "gemini_vision");
  assert.equal(result.text, "");
  assert.equal(result.incomplete, true);
});

test("an image-only scanned PDF takes the OCR path and preserves Turkish text and page order", async () => {
  const buffer = await makeScannedPdf(2);
  const parsed = await readPdfText(buffer);
  assert.equal(parsed.text.trim(), "");
  assert.equal(parsed.pageCount, 2);
  let calls = 0;
  interceptRequests((url) => {
    assert.ok(url.includes(":generateContent"));
    calls++;
    return geminiReply(pageText(1) + "\n" + pageText(2));
  });
  const result = await extractFromFile("tarama.pdf", "application/pdf", buffer, "auto");
  assert.equal(calls, 1);
  assert.equal(result.usedAI, true);
  assertPageOrder(result.text, 2);
  assert.ok(result.text.includes("ÇĞİÖŞÜ çğıöşü"));
});

test("a PDF without its xref/trailer is repaired without losing its page count", async () => {
  const original = await makePdf(3, "Legal document contents for repair regression checks.");
  const xref = original.toString("latin1").lastIndexOf("\nxref\n");
  assert.ok(xref > 0);
  const damaged = original.subarray(0, xref);
  const parsed = await readPdfText(damaged);
  assert.equal(parsed.pageCount, 3);
  assert.ok(parsed.repairedBuffer);
  const chunks = await splitPdf(parsed.repairedBuffer, 1);
  assert.deepEqual(chunks?.map((chunk) => chunk.startPage), [1, 2, 3]);
  interceptRequests((url) => {
    assert.ok(url.includes(":generateContent"));
    return geminiReply([1, 2, 3].map(pageText).join("\n\n"));
  });
  const result = await extractFromFile("bozuk-xref.pdf", "application/pdf", damaged, "gemini_vision");
  assertPageOrder(result.text, 3);
});

test("an irrecoverably corrupt PDF returns an explicit failure without fabricated pages", async () => {
  interceptRequests(() => new Response("Invalid PDF", { status: 403 }));
  const buffer = Buffer.from("%PDF-1.7\nnot a PDF object tree\n%%EOF");
  assert.equal(await splitPdf(buffer, 1), null);
  const result = await extractFromFile("broken.pdf", "application/pdf", buffer, "auto");
  assert.equal(result.text, "");
  assert.equal(result.incomplete, true);
  assert.ok(result.error);
});

test("missing provider keys do not turn partial pages into successful output", async () => {
  process.env.ANTHROPIC_API_KEY = "";
  process.env.OPENAI_API_KEY = "";
  interceptRequests((url) => {
    assert.ok(url.includes(":generateContent"));
    return geminiReply(pageText(1));
  });
  const result = await extractFromFile("no-fallback-key.pdf", "application/pdf", await makePdf(2), "gemini_vision");
  assert.equal(result.text, "");
  assert.equal(result.incomplete, true);
});

test("all-keys-missing reports failure without making network calls", async () => {
  process.env.GEMINI_API_KEY = "";
  process.env.ANTHROPIC_API_KEY = "";
  process.env.OPENAI_API_KEY = "";
  const result = await extractFromFile("no-keys.pdf", "application/pdf", await makePdf(1), "auto");
  assert.equal(result.text, "");
  assert.ok(result.error);
  assert.ok(result.userMessage);
});

async function makeMixedPdf(): Promise<Buffer> {
  const doc = await PDFDocument.load(await makePdf(1, "Readable digital legal text and docket information. ".repeat(30)));
  const scan = await PDFDocument.load(await makeScannedPdf(1));
  const [page] = await doc.copyPages(scan, [0]);
  doc.addPage(page);
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

test("auto mode does not mistake a long digital page for complete text in a mixed scanned PDF", async () => {
  const buffer = await makeMixedPdf();
  const parsed = await readPdfText(buffer);
  assert.equal(assessTextQuality(parsed.text, parsed.pageCount).usable, true);
  let calls = 0;
  interceptRequests((url) => {
    assert.ok(url.includes(":generateContent"));
    calls++;
    return geminiReply(pageText(1) + "\n" + pageText(2));
  });
  const result = await extractFromFile("mixed-scan.pdf", "application/pdf", buffer, "auto");
  assert.equal(calls, 1, "The scanned page must trigger OCR despite sufficient aggregate text");
  assertPageOrder(result.text, 2);
  assert.equal(result.usedAI, true);
});

test("failed OCR cannot fall back to only the digital portion of a mixed scanned PDF", async () => {
  process.env.GEMINI_API_KEY = "";
  process.env.ANTHROPIC_API_KEY = "";
  process.env.OPENAI_API_KEY = "";
  const result = await extractFromFile("mixed-no-keys.pdf", "application/pdf", await makeMixedPdf(), "gemini_vision");
  assert.equal(result.text, "");
  assert.equal(result.incomplete, true);
  assert.equal(result.pageCount, 2);
});

test("fast mode reports missing scanned pages without invoking AI or returning partial text", async () => {
  const result = await extractFromFile("mixed-fast.pdf", "application/pdf", await makeMixedPdf(), "fast");
  assert.equal(result.text, "");
  assert.equal(result.incomplete, true);
  assert.equal(result.usedAI, false);
  assert.equal(result.pageCount, 2);
});

test("fast mode remains non-AI and digital PDFs keep their existing auto fast path", async () => {
  const buffer = await makePdf(1, "Legal document with readable digital text and case information. ".repeat(10));
  const fast = await extractFromFile("digital.pdf", "application/pdf", buffer, "fast");
  const auto = await extractFromFile("digital.pdf", "application/pdf", buffer, "auto");
  assert.equal(fast.method, "pdf_parse_fast");
  assert.equal(auto.method, "auto_pdf_parse");
  assert.equal(fast.usedAI, false);
  assert.equal(auto.text, fast.text);
});

test("explicitly blank pages and short legal labels are not dropped", async () => {
  interceptRequests(() => geminiReply("--- SAYFA 1 ---\n[BOŞ SAYFA]"));
  const result = await extractFromFile("blank.pdf", "application/pdf", await makePdf(1), "gemini_vision");
  assert.equal(result.error, undefined);
  assert.match(result.text, /\[BOŞ SAYFA\]/);
  assert.deepEqual([...readPdfOcrPages("--- SAYFA 1 ---\nEK 1", 1, 1).values()], ["EK 1"]);
});

test("coverage validation preserves Turkish characters and sorts physical pages", () => {
  const pages = readPdfOcrPages(pageText(3) + "\n" + pageText(1) + "\n" + pageText(2), 1, 3);
  assertPageOrder(formatPdfOcrPages(pages), 3);
  assert.equal(pages.get(2), `${turkishText} Sayfa kaydı 2.`);
  assert.equal(assessTextQuality(turkishText.repeat(10), 2).usable, true);
});

test("duplicate, missing, unnumbered multi-page and out-of-range pages are never complete", () => {
  assert.equal(readPdfOcrPages(pageText(1) + "\n" + pageText(1), 1, 2).size, 0);
  assert.equal(readPdfOcrPages(turkishText, 1, 2).size, 0);
  assert.equal(readPdfOcrPages(pageText(3), 1, 2).size, 0);
  assert.equal(readPdfOcrPages(pageText(1), 1, 2).size, 1);
  assert.equal(readPdfOcrPages(pageText(1), 1, 1, true).size, 0);
});

test("broken Turkish encoding triggers fallback while recovered Unicode remains unchanged", async () => {
  const mojibake = "Ýstanbul Þüpheli Ðerekçe ýþð ".repeat(20);
  assert.equal(readPdfOcrPages(mojibake, 1, 1).size, 0);
  assert.equal(assessTextQuality(mojibake, 1).usable, false);
  interceptRequests((url) => {
    if (url.includes(":generateContent")) return geminiReply(mojibake);
    if (url.endsWith("/v1/messages")) return claudeReply(turkishText);
    throw new Error(`Unexpected provider: ${url}`);
  });
  const result = await extractFromFile("turkce.pdf", "application/pdf", await makePdf(1), "gemini_vision");
  assert.equal(result.text, `--- SAYFA 1 ---\n\n${turkishText}`);
});


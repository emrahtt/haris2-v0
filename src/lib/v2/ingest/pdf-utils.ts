/**
 * HARIS v2 — PDF yardımcıları: onarım, metin kalite kontrolü, sayfa bölme
 */

import pdfParse from "pdf-parse";
import { PDFDocument } from "pdf-lib";

interface PdfTextPage {
  pageNumber: number;
  getTextContent(options: {
    normalizeWhitespace: boolean;
    disableCombineTextItems: boolean;
  }): Promise<{ items: Array<{ str: string; transform: number[] }> }>;
}

async function parsePdf(buffer: Buffer): Promise<PdfTextResult> {
  const pageTexts: string[] = [];
  // Legacy pdf.js expects copying Uint8Array.slice(), not Buffer.slice() views;
  // pdf-parse accepts typed arrays at runtime despite its Buffer-only declaration.
  const parsed = await pdfParse(new Uint8Array(buffer) as Buffer, {
    pagerender: async (page: PdfTextPage) => {
      const content = await page.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      });
      let text = "";
      let lastY: number | undefined;
      for (const item of content.items) {
        const y = item.transform[5];
        text += lastY === y || !lastY ? item.str : `\n${item.str}`;
        lastY = y;
      }
      pageTexts[page.pageNumber - 1] = text.trim();
      return text;
    },
  });
  const pageCount = parsed.numpages || 0;
  return {
    text: parsed.text?.trim() ?? "",
    pageCount,
    // pdf-parse swallows individual page failures, so unvisited pages must stay missing.
    pageTexts: Array.from({ length: pageCount }, (_, i) => pageTexts[i] ?? ""),
  };
}

export interface PdfTextResult {
  text: string;
  pageCount: number;
  pageTexts: string[];
  /** pdf-parse orijinal dosyayı açamadı, pdf-lib ile yeniden yazılmış hali okundu */
  repairedBuffer?: Buffer;
}

async function loadWithPdfLib(buffer: Buffer): Promise<PDFDocument | null> {
  try {
    const doc = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
      updateMetadata: false,
    });
    // pdf-lib can load a catalog-less file but throw only when its page tree is accessed.
    doc.getPageCount();
    return doc;
  } catch {
    return null;
  }
}

/**
 * pdf-parse ile metin okur. Dosya bozuk xref/trailer yüzünden açılamazsa
 * pdf-lib ile yeniden yazıp (çoğu hafif bozukluğu onarır) tekrar dener.
 */
export async function readPdfText(buffer: Buffer): Promise<PdfTextResult> {
  try {
    return await parsePdf(buffer);
  } catch {
    // aşağıda onarım denenir
  }

  const doc = await loadWithPdfLib(buffer);
  if (!doc) return { text: "", pageCount: 0, pageTexts: [] };

  try {
    const repairedBuffer = Buffer.from(await doc.save());
    try {
      const parsed = await parsePdf(repairedBuffer);
      return { ...parsed, repairedBuffer };
    } catch {
      return {
        text: "",
        pageCount: doc.getPageCount(),
        pageTexts: Array<string>(doc.getPageCount()).fill(""),
        repairedBuffer,
      };
    }
  } catch {
    return {
      text: "",
      pageCount: doc.getPageCount(),
      pageTexts: Array<string>(doc.getPageCount()).fill(""),
    };
  }
}

export interface TextQuality {
  usable: boolean;
  reason?: string;
}

/**
 * pdf-parse çıktısı gerçekten okunabilir mi? Uzun ama bozuk metni (yanlış font
 * kodlaması, Türkçe karakterlerin Ý/Þ/Ð olması, (cid:NN) blokları, taranmış
 * sayfalarda sadece üst bilgi) yakalar; bu durumda AI OCR'a geçilir.
 */
export function assessTextQuality(text: string, pageCount: number): TextQuality {
  const compact = text.replace(/\s+/g, "");
  if (compact.length < 200) return { usable: false, reason: "çok az metin" };

  const perPage = compact.length / Math.max(pageCount, 1);
  if (pageCount > 1 && perPage < 150) {
    return { usable: false, reason: "sayfa başına çok az metin (taranmış olabilir)" };
  }

  if ((text.match(/\(cid:\d+\)/g) ?? []).length > 20) {
    return { usable: false, reason: "font kodlaması bozuk" };
  }

  const broken = (compact.match(/[\uFFFD\uE000-\uF8FF]/g) ?? []).length;
  if (broken / compact.length > 0.01) {
    return { usable: false, reason: "okunamayan karakterler" };
  }

  const letters = (compact.match(/\p{L}/gu) ?? []).length;
  if (letters / compact.length < 0.45) {
    return { usable: false, reason: "harf oranı çok düşük" };
  }

  // Windows-1254 metnin 1252 olarak çözülmesi: İ→Ý, Ş→Þ, Ğ→Ð, ı→ý, ş→þ, ğ→ð
  const mojibake = (compact.match(/[ÝÞÐýþð]/g) ?? []).length;
  if (mojibake > 5 && mojibake / letters > 0.003) {
    return { usable: false, reason: "Türkçe karakter kodlaması bozuk" };
  }

  return { usable: true };
}

export function assessPdfTextQuality(parsed: PdfTextResult): TextQuality {
  if (parsed.pageCount < 1 || parsed.pageTexts.length !== parsed.pageCount) {
    return { usable: false, reason: "PDF sayfa kapsamı doğrulanamadı" };
  }
  const overall = assessTextQuality(parsed.text, parsed.pageCount);
  if (!overall.usable) return overall;
  for (let i = 0; i < parsed.pageTexts.length; i++) {
    const quality = assessTextQuality(parsed.pageTexts[i], 1);
    if (!quality.usable) return { usable: false, reason: `Sayfa ${i + 1}: ${quality.reason}` };
  }
  return overall;
}

export interface PdfChunk {
  data: Buffer;
  startPage: number;
  endPage: number;
}

/**
 * Çok sayfalı PDF'i parçalara böler (model çıktı sınırına takılmamak için).
 * Bölünemezse null döner; çağıran tarafta dosya tek parça gönderilir.
 */
export async function splitPdf(
  buffer: Buffer,
  pagesPerChunk: number
): Promise<PdfChunk[] | null> {
  const source = await loadWithPdfLib(buffer);
  if (!source || source.isEncrypted) return null;

  const total = source.getPageCount();
  if (total === 0) return null;
  if (total <= pagesPerChunk) return [{ data: buffer, startPage: 1, endPage: total }];

  try {
    const chunks: PdfChunk[] = [];
    for (let start = 0; start < total; start += pagesPerChunk) {
      const end = Math.min(start + pagesPerChunk, total);
      const target = await PDFDocument.create();
      const indices = Array.from({ length: end - start }, (_, i) => start + i);
      const pages = await target.copyPages(source, indices);
      pages.forEach((page) => target.addPage(page));
      chunks.push({
        data: Buffer.from(await target.save()),
        startPage: start + 1,
        endPage: end,
      });
    }
    return chunks;
  } catch {
    return null;
  }
}

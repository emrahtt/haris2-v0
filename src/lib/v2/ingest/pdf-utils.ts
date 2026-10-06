/**
 * HARIS v2 — PDF yardımcıları: onarım, metin kalite kontrolü, sayfa bölme
 */

import pdfParse from "pdf-parse";
import { PDFDocument } from "pdf-lib";

export interface PdfTextResult {
  text: string;
  pageCount: number;
  /** pdf-parse orijinal dosyayı açamadı, pdf-lib ile yeniden yazılmış hali okundu */
  repairedBuffer?: Buffer;
}

async function loadWithPdfLib(buffer: Buffer): Promise<PDFDocument | null> {
  try {
    return await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
      updateMetadata: false,
    });
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
    const parsed = await pdfParse(buffer);
    return { text: parsed.text?.trim() ?? "", pageCount: parsed.numpages || 0 };
  } catch {
    // aşağıda onarım denenir
  }

  const doc = await loadWithPdfLib(buffer);
  if (!doc) return { text: "", pageCount: 0 };

  try {
    const repairedBuffer = Buffer.from(await doc.save());
    try {
      const parsed = await pdfParse(repairedBuffer);
      return {
        text: parsed.text?.trim() ?? "",
        pageCount: parsed.numpages || doc.getPageCount(),
        repairedBuffer,
      };
    } catch {
      return { text: "", pageCount: doc.getPageCount(), repairedBuffer };
    }
  } catch {
    return { text: "", pageCount: doc.getPageCount() };
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

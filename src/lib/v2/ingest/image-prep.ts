/**
 * HARIS v2 — OCR öncesi görsel hazırlığı
 *
 * - EXIF yönüne göre döndürür (telefon fotoğrafları yan/ters gelmesin)
 * - Kısmen bozuk / yarım inmiş dosyaları tolere eder (failOn: "none")
 * - Çok büyük görselleri küçültür, desteklenmeyen formatları PNG'ye çevirir
 * Sharp açamazsa orijinal bayt gönderilir; Gemini'nin kendi çözücüsü genelde okur.
 */

const MAX_EDGE_PX = 3072;

export interface PreparedImage {
  data: Buffer;
  mimeType: string;
}

function normalizeMime(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower === "image/jpg" || lower === "image/pjpeg") return "image/jpeg";
  return lower;
}

export async function prepareImage(buffer: Buffer, mimeType: string): Promise<PreparedImage> {
  const mime = normalizeMime(mimeType);
  try {
    const sharp = (await import("sharp")).default;
    const image = sharp(buffer, { failOn: "none" }).rotate();
    const meta = await image.metadata();
    if (Math.max(meta.width ?? 0, meta.height ?? 0) > MAX_EDGE_PX) {
      image.resize({
        width: MAX_EDGE_PX,
        height: MAX_EDGE_PX,
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    if (mime === "image/jpeg") {
      return { data: await image.jpeg({ quality: 92 }).toBuffer(), mimeType: "image/jpeg" };
    }
    return { data: await image.png().toBuffer(), mimeType: "image/png" };
  } catch {
    return { data: buffer, mimeType: mime };
  }
}

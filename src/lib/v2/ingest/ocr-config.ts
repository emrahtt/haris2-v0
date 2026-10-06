/**
 * HARIS v2 — OCR (belgeden metin çıkarma) model ayarları
 *
 * Bu ayarlar GÖRSEL ANALİZ modelinden (HARIS_VISION_MODEL → providers/index.ts
 * "vision" rolü) bilerek ayrıdır: OCR birebir transkripsiyon ister, görsel analiz
 * ise yorum üretir. Aynı env değişkenini paylaşmaları, örn. HARIS_VISION_MODEL'e
 * bir Claude modeli yazıldığında OpenAI OCR hattının tamamen kırılmasına yol açıyordu.
 *
 * Env değişkenleri ("provider:model" veya sadece "model" formatı kabul edilir):
 *   HARIS_OCR_MODEL           → Birincil OCR (Gemini, native PDF)   varsayılan: gemini-3.8-flash
 *   HARIS_OCR_FALLBACK_MODEL  → Gemini yedek modeli                 varsayılan: gemini-3.5-flash
 *   HARIS_OCR_CLAUDE_MODEL    → Claude native PDF OCR               varsayılan: claude-sonnet-4-6
 *   HARIS_OCR_OPENAI_MODEL    → OpenAI sayfa-görsel OCR             varsayılan: gpt-4o
 */

const RETIRED_GEMINI_MODEL = /^gemini-(1\.|2\.0)|-exp(-|$)/;

function modelId(spec: string | undefined): string | undefined {
  const value = spec?.trim();
  if (!value) return undefined;
  const id = value.includes(":") ? value.split(":").slice(1).join(":") : value;
  return id.trim() || undefined;
}

function primaryGeminiModel(): string {
  const explicit = modelId(process.env.HARIS_OCR_MODEL);
  if (explicit) return explicit;
  // Eski HARIS_GEMINI_MODEL hâlâ okunur, ama kapatılmış bir modeli gösteriyorsa yok sayılır.
  const legacy = modelId(process.env.HARIS_GEMINI_MODEL);
  if (legacy && !RETIRED_GEMINI_MODEL.test(legacy)) return legacy;
  return "gemini-3.8-flash";
}

export interface OcrModels {
  gemini: string;
  geminiFallback: string;
  claude: string;
  openai: string;
}

export function getOcrModels(): OcrModels {
  return {
    gemini: primaryGeminiModel(),
    geminiFallback:
      modelId(process.env.HARIS_OCR_FALLBACK_MODEL) ?? "gemini-3.5-flash",
    claude: modelId(process.env.HARIS_OCR_CLAUDE_MODEL) ?? "claude-sonnet-4-6",
    openai: modelId(process.env.HARIS_OCR_OPENAI_MODEL) ?? "gpt-4o",
  };
}

export const OCR_SYSTEM_PROMPT = `Sen profesyonel Türk hukuk belge OCR uzmanısın. Görevin belgedeki metni BİREBİR ve EKSİKSİZ yazıya dökmek.

Türkçe karakterleri (ç, ğ, ı, ö, ş, ü, İ, Ç, Ğ, Ş, Ö, Ü) HATASIZ koru. ASLA Arapça, Farsça, İbranice veya başka alfabe ekleme.

KURALLAR:
1. Sadece belgedeki metni döndür; yorum, özet veya açıklama YOK
2. Hiçbir sayfayı veya paragrafı atlama, kısaltma yapma
3. Soluk, eğik, düşük çözünürlüklü veya kısmen bozuk bölümleri de en iyi tahminle oku; gerçekten okunamayan yerlere [okunamadı] yaz
4. Tabloları Markdown table formatında (| sütun | sütun |) yaz
5. Grafikleri açıkla: [GRAFİK: kısa açıklama]
6. Damga/imza/kaşeyi belirt: [DAMGA] [İMZA] [KAŞE]
7. Sayfa başlarını işaretle: --- SAYFA N ---
8. Paragraf yapısı, madde numaraları, listeler korunmalı
9. T.C. kimlik no, esas/karar no, tarih ve tutarları rakam rakam dikkatle oku`;

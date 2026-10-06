/**
 * OCR — Görsel Belgelerden Metin Çıkarma
 *
 * İki mod:
 * 1. Gerçek: OpenAI GPT-4o Vision API
 *    - Türkçe destekli, çok doğru
 *    - El yazısı, damga, imza tanıma
 *    - Tablo/form yapısını koruma
 *    - Maliyet: ~$0.005 / sayfa
 *
 * 2. Demo: Akıllı heuristic
 *    - Dosya adından bağlam çıkarma
 *    - Türk hukuk belgesi template eşleştirme
 */

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { hasOpenAI, isAiDemoMode } from "@/lib/ai/config";
import { geminiOcr, hasGeminiKey } from "@/lib/v2/ingest/gemini-ocr";
import { prepareImage } from "@/lib/v2/ingest/image-prep";

interface OcrResult {
  text: string;
  method: "gemini-vision" | "gpt-4o-vision" | "heuristic-demo";
  confidence: "high" | "medium" | "low";
  warnings: string[];
}

const OCR_SYSTEM_PROMPT = `Sen HARIS OCR uzmanısın. Türk hukuk belgelerini fotoğraf veya tarama görüntüsünden okuma konusunda uzmansın.

GÖREVİN:
1. Görseldeki TÜM metni harfi harfine çıkar
2. Tablo yapısını koru (markdown table formatında)
3. Başlık hiyerarşisini koru (## başlıklar)
4. Damga, kaşe, imza varsa BELİRT: [DAMGA: ...] [İMZA: ...] [KAŞE: ...]
5. Okunamayan kısımlar için [okunamadı] yaz
6. Tarihleri TR formatında bırak (DD.MM.YYYY)
7. T.C. kimlik no, dosya no, esas no gibi numaraları DİKKATLİ oku

ÇIKTI: SADECE metin döndür, açıklama yapma. Markdown kullan.`;

/**
 * GPT-4o Vision ile OCR
 */
async function ocrWithGpt4oVision(
  imageBuffer: Buffer,
  mimeType: string
): Promise<OcrResult> {
  try {
    const base64 = imageBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const { text } = await generateText({
      model: openai("gpt-4o"),
      system: OCR_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Bu görseldeki tüm metni titizlikle çıkar:",
            },
            {
              type: "image",
              image: dataUrl,
            },
          ],
        },
      ],
      maxTokens: 4000,
      temperature: 0.1, // Doğruluk için düşük
    });

    return {
      text: text.trim(),
      method: "gpt-4o-vision",
      confidence: text.length > 100 ? "high" : "medium",
      warnings: text.includes("[okunamadı]")
        ? ["Bazı bölümler okunamadı"]
        : [],
    };
  } catch (err) {
    return {
      text: "",
      method: "gpt-4o-vision",
      confidence: "low",
      warnings: [
        `OCR hatası: ${err instanceof Error ? err.message : "bilinmeyen"}`,
      ],
    };
  }
}

/**
 * Demo: dosya adından + boyuttan heuristic
 */
function ocrHeuristic(fileName: string, sizeBytes: number): OcrResult {
  const lower = fileName.toLowerCase();
  const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);

  let text = "";

  if (lower.includes("kaza") || lower.includes("tutanak")) {
    text = `# KAZA TESPİT TUTANAĞI

**Tarih:** 12.03.2024
**Saat:** 08:42
**Yer:** Beşiktaş / İstanbul, Barbaros Bulvarı kavşağı
**Tutanak No:** 2024/8842

## TARAFLAR
| Sıra | Sürücü | Plaka | Kusur |
|------|--------|-------|-------|
| Araç 1 | Ahmet Yılmaz | 34 XXX 1234 | %0 |
| Araç 2 | Mehmet Öztürk | 34 YYY 5678 | %100 |

## OLAY
Araç 2 sürücüsünün kavşakta kırmızı ışıkta geçmesi sonucu Araç 1'e arkadan çarpması olayı meydana gelmiştir.

[İMZA: Trafik memuru]
[KAŞE: İstanbul Emniyet Müdürlüğü]

---
*[OCR demo modu — gerçek GPT-4o Vision için OPENAI_API_KEY ekleyin. Dosya: ${fileName} / ${sizeMB} MB]*`;
  } else if (lower.includes("atk") || lower.includes("rapor") || lower.includes("maluliyet")) {
    text = `# ADLİ TIP KURUMU MALULIYET RAPORU

**Rapor No:** ATK-2024/15672
**Düzenleme Tarihi:** 18.10.2024
**Hasta:** Ahmet Yılmaz

## TESPİT
- Sürekli iş gücü kaybı oranı: **%32**
- Maluliyet türü: Kalıcı
- Çalışma kapasitesi azalması: %32

## TIBBİ İNCELEME
Hastanın 12.03.2024 tarihli trafik kazasında uğradığı yaralanmalar incelendi. Kaza öncesi mevcut bel fıtığı rahatsızlığının kaza ile birlikte ağırlaştığı tespit edildi.

[İMZA: 3 uzman bilirkişi heyeti]
[KAŞE: Adli Tıp Kurumu]

---
*[OCR demo — ${fileName}]*`;
  } else if (lower.includes("fatura") || lower.includes("hastane")) {
    text = `# HASTANE FATURASI

**Kurum:** Acıbadem Hastanesi
**Hasta:** A. Yılmaz
**Tarih:** 23.03.2024
**Tutar:** 247.000,00 ₺

## HİZMETLER
- Yoğun Bakım (11 gün): 165.000 ₺
- Ortopedik Ameliyat: 65.000 ₺
- İlaç ve Sarf: 17.000 ₺

---
*[OCR demo — ${fileName}]*`;
  } else if (lower.includes("kimlik") || lower.includes("nufus")) {
    text = `# T.C. KİMLİK BELGESİ

**T.C. Kimlik No:** 12345678901
**Ad Soyad:** Ahmet YILMAZ
**Baba Adı:** [okunamadı]
**Doğum Tarihi:** 15.07.1978
**Doğum Yeri:** İstanbul

[FOTOĞRAF]
[KAŞE: Nüfus Müdürlüğü]

---
*[OCR demo — ${fileName}]*`;
  } else {
    text = `# ${fileName.replace(/\.[^.]+$/, "")}

[OCR DEMO MODU]

Bu görselden metin çıkarımı için **OpenAI GPT-4o Vision** API'ı gereklidir.

**Dosya bilgileri:**
- Ad: ${fileName}
- Boyut: ${sizeMB} MB
- Tahmini sayfa: ${Math.max(1, Math.round(sizeBytes / 250000))}

**GERÇEK OCR İÇİN:**
\`\`\`
.env.local
OPENAI_API_KEY=sk-...
\`\`\`

Sonra dosyayı yeniden yükleyin. GPT-4o Vision:
- Türkçe el yazısı + matbaa metin tanır
- Tabloları markdown'a dönüştürür
- İmza, damga, kaşe işaretler
- Tarihleri, dosya/esas numaralarını doğru okur
- Maliyet: ~$0.005 / sayfa

---
*[Şu an dosya saklandı ve sınıflandırma için heuristic kullanıldı.]*`;
  }

  return {
    text,
    method: "heuristic-demo",
    confidence: "low",
    warnings: ["OCR demo modunda — gerçek görsel okuma için OPENAI_API_KEY gerekli"],
  };
}

/**
 * Public API
 */
export async function performOcr(
  imageBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<OcrResult> {
  if (hasGeminiKey()) {
    const prepared = await prepareImage(imageBuffer, mimeType);
    const gemini = await geminiOcr({
      data: prepared.data,
      mimeType: prepared.mimeType,
      systemPrompt: OCR_SYSTEM_PROMPT,
      prompt: "Bu görseldeki tüm metni titizlikle çıkar:",
    });
    if (gemini.ok) {
      return {
        text: gemini.text,
        method: "gemini-vision",
        confidence: gemini.text.length > 100 ? "high" : "medium",
        warnings: gemini.text.includes("[okunamadı]") ? ["Bazı bölümler okunamadı"] : [],
      };
    }
    console.warn("[ocr] Gemini başarısız, GPT-4o'ya geçiliyor:", gemini.error);
  }

  if (!isAiDemoMode && hasOpenAI) {
    try {
      const result = await ocrWithGpt4oVision(imageBuffer, mimeType);
      if (result.text.length > 0) return result;
      // Vision API başarısız olduysa fallback
    } catch (err) {
      console.warn("[ocr] GPT-4o Vision başarısız, heuristic'e fallback:", err);
    }
  }
  return ocrHeuristic(fileName, imageBuffer.length);
}

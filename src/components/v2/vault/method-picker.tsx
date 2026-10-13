"use client";

/**
 * HARIS v2 — OCR Yöntem Seçici Modal
 *
 * Kullanıcı belge yüklerken hangi AI ile okunacağını seçer:
 *   - Akıllı (auto) — varsayılan, çoğu durumda iyi
 *   - Hızlı — AI yok, pdf-parse, ucuz/anlık
 *   - Claude Vision — Anthropic native PDF
 *   - GPT-4o Vision — kanıtlanmış pipeline (PDF → PNG)
 *   - Gemini Pro Vision — Türkçe + tablo en iyi, ucuz
 *   - Best of 3 — 3 modeli paralel, en iyiyi seç (en pahalı)
 */

import { useState } from "react";

export type ExtractionMethod =
  | "auto"
  | "fast"
  | "claude_vision"
  | "openai_vision"
  | "gemini_vision"
  | "best_of_3";

interface Props {
  files: File[];
  defaultMethod?: ExtractionMethod;
  onConfirm: (method: ExtractionMethod) => void;
  onCancel: () => void;
}

interface MethodOption {
  id: ExtractionMethod;
  emoji: string;
  label: string;
  desc: string;
  costEstimate: string;
  speed: string;
  quality: "Düşük" | "Orta" | "Yüksek" | "En yüksek";
  qualityColor: string;
  pros: string[];
  cons: string[];
  recommended?: boolean;
}

const METHODS: MethodOption[] = [
  {
    id: "auto",
    emoji: "🤖",
    label: "Akıllı (Otomatik)",
    desc: "Önce ücretsiz metin çıkarır. Taranmış, bozuk veya hatalı kodlanmış PDF'de Gemini ile okur; olmazsa Claude ve GPT'ye geçer.",
    costEstimate: "$0 – $0.05 / belge",
    speed: "Hızlı",
    quality: "Yüksek",
    qualityColor: "text-emerald-300",
    recommended: true,
    pros: ["Bozuk dosyaları da okur", "Düşük maliyet", "Otomatik yedek model"],
    cons: ["Çok karmaşık tablolarda Üçlü karşılaştırma daha iyi olabilir"],
  },
  {
    id: "fast",
    emoji: "⚡",
    label: "Hızlı (AI yok)",
    desc: "Sadece pdf-parse / Word okur. İnternet ve AI çağrısı yok.",
    costEstimate: "$0",
    speed: "Anlık",
    quality: "Düşük",
    qualityColor: "text-slate-400",
    pros: ["Bedava", "1–2 saniye"],
    cons: ["Taranmış PDF okunmaz", "Tablo/damga kaybolur"],
  },
  {
    id: "claude_vision",
    emoji: "🟣",
    label: "Claude Vision (Opus 5)",
    desc: "Resmi Anthropic API, native PDF. Hukuk metni ve Türkçe için güçlü.",
    costEstimate: "$0.01 – $0.12 / belge",
    speed: "Orta (30–90 sn)",
    quality: "Yüksek",
    qualityColor: "text-violet-300",
    pros: ["Hukuk dili", "Türkçe karakter", "Resmi API"],
    cons: ["Çok sayfalı evrakta süre uzar"],
  },
  {
    id: "openai_vision",
    emoji: "🟢",
    label: "GPT Vision",
    desc: "PDF sayfa sayfa görsele çevrilir, GPT okur. Damga ve tablo için güvenilir.",
    costEstimate: "$0.03 – $0.30 / belge",
    speed: "Orta (30–90 sn)",
    quality: "Yüksek",
    qualityColor: "text-emerald-300",
    pros: ["Taranmış evrak", "Tablo / imza", "Kanıtlanmış hat"],
    cons: ["Sayfa başına maliyet"],
  },
  {
    id: "gemini_vision",
    emoji: "🔵",
    label: "Gemini 3.8 Flash",
    desc: "PDF'i dönüştürmeden olduğu gibi Gemini'ye verir. Hafif bozuk, taranmış ve fotoğraf belgelerde en başarılı.",
    costEstimate: "$0.001 – $0.03 / belge",
    speed: "Hızlı (15–60 sn)",
    quality: "En yüksek",
    qualityColor: "text-sky-300",
    pros: ["En ucuz", "Türkçe karakter", "Tablo"],
    cons: ["GEMINI_API_KEY gerekir"],
  },
  {
    id: "best_of_3",
    emoji: "👑",
    label: "Üçlü karşılaştırma",
    desc: "Claude + GPT + Gemini aynı anda çalışır; en uzun ve tutarlı metin seçilir.",
    costEstimate: "$0.05 – $0.50 / belge",
    speed: "Yavaş (60–180 sn)",
    quality: "En yüksek",
    qualityColor: "text-[#C9A961]",
    pros: ["Hata payı en düşük", "Kritik evrak"],
    cons: ["3 kat maliyet ve süre"],
  },
];

export function MethodPicker({
  files,
  defaultMethod = "auto",
  onConfirm,
  onCancel,
}: Props) {
  const [selected, setSelected] = useState<ExtractionMethod>(defaultMethod);
  const [rememberChoice, setRememberChoice] = useState(false);

  const handleConfirm = () => {
    if (rememberChoice) {
      try {
        localStorage.setItem("haris_default_ocr_method", selected);
      } catch {
        // ignore
      }
    }
    onConfirm(selected);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-[#0E1B30] border border-white/15 rounded-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              className="text-xl font-bold text-[#C9A961]"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              🔬 OCR / Belge Okuma Yöntemi
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {files.length} dosya seçildi:{" "}
              {files.slice(0, 3).map((f) => f.name).join(", ")}
              {files.length > 3 && ` (+${files.length - 3} dosya)`}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="text-xs text-slate-400 mb-3 p-2 rounded border border-amber-500/20 bg-amber-500/5">
          💡 <strong>Kısa rehber:</strong> Düz metin Word/PDF → Hızlı.
          Tutanak, tablo, damga → Gemini 2.5 Pro. Kritik evrak → Üçlü
          karşılaştırma. Varsayılan Akıllı çoğu dosyada yeter.
        </div>

        {/* Method kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {METHODS.map((m) => {
            const isSelected = selected === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelected(m.id)}
                className={`text-left p-3 rounded-lg border transition relative ${
                  isSelected
                    ? "border-[#C9A961] bg-[#C9A961]/10 ring-1 ring-[#C9A961]/30"
                    : "border-white/10 hover:border-white/30 bg-white/[0.02]"
                }`}
              >
                {m.recommended && (
                  <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ÖNERİLEN
                  </span>
                )}
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-2xl">{m.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-100">
                      {m.label}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {m.desc}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] mb-2">
                  <span className="text-slate-500">⏱ {m.speed}</span>
                  <span className="text-slate-500">💰 {m.costEstimate}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-semibold ${m.qualityColor}`}>
                    Kalite: {m.quality}
                  </span>
                </div>
                {isSelected && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-[10px] space-y-1">
                    <div>
                      <span className="text-emerald-400">✓ </span>
                      <span className="text-slate-400">{m.pros.join(" · ")}</span>
                    </div>
                    <div>
                      <span className="text-amber-400">⚠ </span>
                      <span className="text-slate-400">{m.cons.join(" · ")}</span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Hatırlama checkbox */}
        <label className="flex items-center gap-2 text-xs text-slate-400 mb-4">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(e) => setRememberChoice(e.target.checked)}
            className="rounded"
          />
          Bu seçimi sonraki yüklemeler için varsayılan yap
        </label>

        {/* Butonlar */}
        <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded text-sm text-slate-400 hover:text-slate-200"
          >
            İptal
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 rounded bg-[#C9A961] text-[#0A1628] font-semibold text-sm hover:bg-[#e6c479]"
          >
            🚀 {files.length} Belgeyi Yükle
          </button>
        </div>
      </div>
    </div>
  );
}

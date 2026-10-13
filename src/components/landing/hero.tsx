import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="relative px-[5%] pt-20 pb-16 text-center">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(600px 300px at 50% 0%, rgba(201,169,97,0.12), transparent 70%)",
        }}
      />

      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--color-gold)]/[0.08] border border-[var(--color-gold)]/25 text-xs text-[var(--color-gold-bright)] mb-7 relative">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)] shadow-[0_0_10px_var(--color-gold)]" />
        Türkiye&apos;nin ilk 12-Ajanlı Hukuk Zekâsı • KVKK Uyumlu
      </div>

      <h1 className="text-[clamp(36px,6vw,68px)] leading-[1.05] mb-6 bg-gradient-to-b from-white to-[#aab8d0] bg-clip-text text-transparent">
        Bir hukuk ofisinin{" "}
        <span className="italic bg-gradient-to-br from-[var(--color-gold-bright)] to-[var(--color-gold)] bg-clip-text text-transparent">
          aylarca
        </span>{" "}
        yapacağı işi,
        <br />
        <span className="italic bg-gradient-to-br from-[var(--color-gold-bright)] to-[var(--color-gold)] bg-clip-text text-transparent">
          saatler içinde.
        </span>
      </h1>

      <p className="max-w-3xl mx-auto mb-10 text-[var(--color-text-2)] text-lg leading-relaxed">
        HARIS, kıdemli ortak avukat zekâsında 12 uzman AI ajanını orkestre eder.
        Dava dosyanızı her açıdan inceler, karşı tarafın saldırılarını önceden simüle eder
        ve <strong>üzerine söz söylenemeyecek</strong> dilekçe ve savunmalar üretir.
      </p>

      <div className="flex gap-3.5 justify-center flex-wrap">
        <Link href="/v2">
          <Button variant="primary" size="lg">
            <Sparkles size={16} /> Ücretsiz Demoya Başla
          </Button>
        </Link>
        <a href="#features">
          <Button variant="ghost" size="lg">
            Nasıl Çalışıyor?
          </Button>
        </a>
      </div>

      <div className="flex gap-8 justify-center mt-12 flex-wrap text-[var(--color-text-3)] text-xs">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ok)] shadow-[0_0_10px_var(--color-ok)]" />
          5M+ Yargıtay/Danıştay/AYM Kararı İndeksli
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ok)] shadow-[0_0_10px_var(--color-ok)]" />
          Tüm Yürürlükteki Türk Mevzuatı
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ok)] shadow-[0_0_10px_var(--color-ok)]" />
          KVKK & Avukat-Müvekkil Gizliliği
        </div>
      </div>

      <HeroMockup />
    </section>
  );
}

function HeroMockup() {
  return (
    <div className="max-w-6xl mx-auto mt-16 relative">
      <div className="bg-gradient-to-b from-[var(--color-bg-2)] to-[var(--color-bg-1)] border border-[var(--color-line-2)] rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7),0_0_80px_rgba(201,169,97,0.08)] overflow-hidden">
        <div className="flex gap-1.5 px-4 py-3.5 border-b border-[var(--color-line)]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#e26b6b88]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#e6b85a88]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#5cc88f88]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_280px] min-h-[380px]">
          {/* Sol panel */}
          <div className="hidden md:block bg-black/20 border-r border-[var(--color-line)] p-4">
            <div className="px-2.5 py-2 rounded-md mb-1 text-xs text-[var(--color-gold-bright)] bg-[var(--color-gold)]/10">
              📁 Aktif Dava
            </div>
            <div className="px-2.5 py-2 rounded-md mb-1 text-xs text-[var(--color-text-2)]">
              📄 Belgeler (47)
            </div>
            <div className="px-2.5 py-2 rounded-md mb-1 text-xs text-[var(--color-text-2)]">
              🧠 Derin Analiz
            </div>
            <div className="px-2.5 py-2 rounded-md mb-1 text-xs text-[var(--color-text-2)]">
              ✨ Dilekçe Üret
            </div>
          </div>

          {/* Orta panel */}
          <div className="p-6 text-left">
            <div className="font-serif text-lg">A. Yılmaz vs. Şahin Otomotiv</div>
            <div className="text-[11px] text-[var(--color-text-3)] mb-4">
              İstanbul 7. Asliye Hukuk • 2025/1842 E. • Tazminat
            </div>

            <div className="bg-white/[0.02] border border-[var(--color-line)] rounded-lg p-3.5 mb-2.5 text-xs">
              <div className="text-[10px] text-[var(--color-gold-bright)] uppercase tracking-[0.1em] mb-1.5">
                Başarı Olasılığı
              </div>
              <div className="font-serif text-3xl text-[var(--color-gold-bright)] font-bold">
                %78
              </div>
              <div className="text-[11px] text-[var(--color-text-3)] mt-1">
                12 emsal Yargıtay kararı baz alınarak
              </div>
            </div>

            <div className="bg-white/[0.02] border border-[var(--color-line)] rounded-lg p-3.5 mb-2.5 text-xs">
              <div className="text-[10px] text-[var(--color-gold-bright)] uppercase tracking-[0.1em] mb-1.5">
                Önerilen Talep Aralığı
              </div>
              <div className="text-sm font-medium">850.000 ₺ – 1.450.000 ₺</div>
              <div className="text-[11px] text-[var(--color-text-3)] mt-1">
                Maddi + manevi tazminat (kazanç kaybı dahil)
              </div>
            </div>

            <div className="bg-white/[0.02] border border-[var(--color-line)] rounded-lg p-3.5 text-xs">
              <div className="text-[10px] text-[var(--color-gold-bright)] uppercase tracking-[0.1em] mb-1.5">
                Kritik Süre
              </div>
              <div className="text-[13px] text-[var(--color-danger)] font-medium">
                ⚠ Cevap dilekçesi: 12 gün kaldı
              </div>
            </div>
          </div>

          {/* Sağ panel — ajanlar */}
          <div className="hidden md:block bg-black/20 border-l border-[var(--color-line)] p-4">
            <div className="text-[10px] text-[var(--color-text-3)] uppercase tracking-[0.1em] mb-3">
              CANLI AJANLAR
            </div>
            {[
              "İçtihat Avcısı: 47 karar tarandı",
              "Hukuki Nitelendirici: BK 49 + KTK 85",
              "Risk Analisti: 3 zayıf yön bulundu",
              "Karşı Taraf: 8 saldırı simüle edildi",
              "Dilekçe Yazarı: %94 hazır",
            ].map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 py-2 text-[11px] text-[var(--color-text-2)] border-b border-dashed border-[var(--color-line)] last:border-0"
              >
                <span className="w-2 h-2 rounded-full bg-[var(--color-ok)] shadow-[0_0_8px_var(--color-ok)] animate-pulse-dot" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

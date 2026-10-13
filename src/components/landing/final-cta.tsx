import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function FinalCTA() {
  return (
    <>
      <section
        className="text-center px-[5%] py-20 border-t border-[var(--color-line)]"
        id="pricing"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(201,169,97,0.04) 100%)",
        }}
      >
        <h2 className="text-[clamp(28px,4vw,42px)] mb-4">
          Davanızın <em className="text-[var(--color-gold-bright)] italic">bekçisi</em>{" "}
          hazır.
        </h2>
        <p className="text-[var(--color-text-2)] mb-8 max-w-xl mx-auto">
          30 gün ücretsiz dene. Kredi kartı gerektirmez. İlk davanı yükle, farkı kendi
          gözlerinle gör.
        </p>
        <Link href="/v2">
          <Button variant="primary" size="lg">
            <Sparkles size={16} /> Demoya Başla
          </Button>
        </Link>
      </section>

      <footer className="px-[5%] py-10 border-t border-[var(--color-line)] text-[var(--color-text-3)] text-xs text-center">
        <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center mb-4 text-[12.5px]">
          <a href="/legal/privacy" className="hover:text-[var(--color-gold-bright)]">Aydınlatma Metni</a>
          <a href="/legal/terms" className="hover:text-[var(--color-gold-bright)]">Kullanım Şartları</a>
          <a href="/legal/cookies" className="hover:text-[var(--color-gold-bright)]">Çerez Politikası</a>
          <a href="/legal/kvkk-basvuru" className="hover:text-[var(--color-gold-bright)]">KVKK Başvuru</a>
          <a href="/pricing" className="hover:text-[var(--color-gold-bright)]">Plan & Fiyatlandırma</a>
        </div>
        HARIS — Davanın Yorulmaz Bekçisi • Yıldız &amp; Ortakları Hukuk Bürosu için
        yapılmıştır • © 2026
        <br />
        <span className="text-[var(--color-text-3)] text-[11px]">
          KVKK uyumlu • Türkiye veri rezidansı • AES-256 şifreli
        </span>
      </footer>
    </>
  );
}

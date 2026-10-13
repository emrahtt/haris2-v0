import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-actions";
import { isDemoMode } from "@/lib/supabase/config";
import { safeInternalPath } from "@/lib/flow/steps";
import { ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = safeInternalPath(sp.next);
  const errorMsg = sp.error;
  const successMsg = sp.message;

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* Sol — markalı görsel kısım */}
      <div
        className="p-15 flex flex-col justify-between border-r border-[var(--color-line)]"
        style={{
          padding: "60px",
          background:
            "linear-gradient(135deg, rgba(7,17,31,0.85), rgba(15,29,51,0.95)), radial-gradient(circle at 30% 30%, rgba(201,169,97,0.15), transparent 60%)",
        }}
      >
        <Logo size="md" />

        <div>
          <p className="font-serif text-[28px] leading-[1.3] italic text-[var(--color-text)]">
            &ldquo;Adalet, gecikirse adalet değildir.&rdquo;
          </p>
          <p className="text-[var(--color-gold-bright)] text-[13px] mt-3.5">
            — William E. Gladstone
          </p>
          <p className="text-[var(--color-text-2)] text-[13.5px] mt-8 leading-relaxed max-w-md">
            HARIS, davanızın her detayını saatler içinde inceleyip, karşı tarafın
            saldırılarını önceden simüle eder ve mahkemeye sunulabilir kalitede dilekçeler
            üretir.
          </p>
        </div>

        <div className="text-[var(--color-text-3)] text-[11px]">© 2026 HARIS Legal AI</div>
      </div>

      {/* Sağ — form */}
      <div className="flex items-center justify-center p-10">
        <form action={signIn} className="w-full max-w-md">
          <input type="hidden" name="next" value={next} />
          <h2 className="text-[28px] mb-2">Tekrar hoş geldiniz</h2>
          <p className="text-[var(--color-text-2)] text-sm mb-8">Hesabınıza giriş yapın</p>

          {/* HATA MESAJI */}
          {errorMsg && (
            <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-[13px] px-3.5 py-3 rounded-lg mb-4 flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block mb-0.5">Giriş yapılamadı</strong>
                <span className="text-[12px] opacity-90">{decodeURIComponent(errorMsg)}</span>
                {errorMsg.toLowerCase().includes("invalid login") && (
                  <div className="text-[11.5px] mt-1.5 text-[var(--color-text-2)]">
                    💡 Olası sebepler:
                    <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                      <li>E-posta veya şifre hatalı</li>
                      <li>Henüz kayıt olmadınız</li>
                      <li>E-posta adresinizi onaylamadınız (gelen kutunuzu kontrol edin)</li>
                    </ul>
                  </div>
                )}
                {errorMsg.toLowerCase().includes("email not confirmed") && (
                  <div className="text-[11.5px] mt-1.5">
                    📧 E-postanızı onaylamanız gerekiyor. Gelen kutunuzu (ve spam klasörünü)
                    kontrol edin.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BAŞARI MESAJI */}
          {successMsg && (
            <div className="bg-[var(--color-ok)]/10 border border-[var(--color-ok)]/30 text-[var(--color-ok)] text-[13px] px-3.5 py-3 rounded-lg mb-4 flex items-start gap-2">
              <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
              <span>{decodeURIComponent(successMsg)}</span>
            </div>
          )}

          {isDemoMode && (
            <div className="bg-[var(--color-info)]/10 border border-[var(--color-info)]/30 text-[var(--color-info)] text-xs px-3.5 py-2.5 rounded-lg mb-4">
              🚀 <strong>Demo Modu Aktif</strong> — Herhangi bir e-posta/şifre ile giriş
              yapabilirsiniz.
            </div>
          )}

          <div className="mb-4">
            <label className="block text-[var(--color-text-2)] text-xs mb-1.5">E-posta</label>
            <input
              name="email"
              type="email"
              required
              defaultValue={isDemoMode ? "ayse.yildiz@yildizhukuk.com" : ""}
              placeholder="ad@hukukburosu.com"
              className="w-full px-3.5 py-3 rounded-lg bg-[var(--color-bg-1)] border border-[var(--color-line)] text-[var(--color-text)] text-sm outline-none focus:border-[var(--color-gold-soft)] transition-colors"
            />
          </div>

          <div className="mb-4">
            <label className="block text-[var(--color-text-2)] text-xs mb-1.5">Şifre</label>
            <input
              name="password"
              type="password"
              required
              defaultValue={isDemoMode ? "demopass123" : ""}
              placeholder="••••••••••"
              className="w-full px-3.5 py-3 rounded-lg bg-[var(--color-bg-1)] border border-[var(--color-line)] text-[var(--color-text)] text-sm outline-none focus:border-[var(--color-gold-soft)] transition-colors"
            />
          </div>

          <div className="flex items-center justify-between my-4 text-xs text-[var(--color-text-2)]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" /> Beni hatırla
            </label>
            <a href="#" className="text-[var(--color-gold-bright)]">
              Şifremi unuttum
            </a>
          </div>

          <Button type="submit" variant="primary" className="w-full justify-center">
            Giriş Yap <ArrowRight size={14} />
          </Button>

          <p className="text-center mt-5 text-[var(--color-text-2)] text-[13px]">
            Hesabın yok mu?{" "}
            <Link href="/register" className="text-[var(--color-gold-bright)]">
              Ücretsiz başla
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

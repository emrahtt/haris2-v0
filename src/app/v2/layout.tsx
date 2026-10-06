/**
 * HARIS — Matter Workspace Layout
 *
 * /v2/* altındaki tüm sayfaların ortak çerçevesi. Uygulamanın ana girişidir;
 * diğer bölümlere (araştırma, kütüphane, takvim) buradan doğrudan geçilir.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { UsageMeter } from "@/components/billing/usage-meter";

export const metadata: Metadata = {
  title: "HARIS · Dava Çalışma Alanı",
  description: "Davanın Yorulmaz Bekçisi — 12 uzman AI ajan orkestrası",
};

const NAV_LINKS = [
  { href: "/v2", label: "Başlangıç" },
  { href: "/research", label: "Araştırma" },
  { href: "/library", label: "Kütüphane" },
  { href: "/calendar", label: "Takvim" },
  { href: "/pricing", label: "Plan" },
];

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-1)] text-[var(--color-text)]">
      <header className="sticky top-0 z-50 border-b border-[var(--color-line)] bg-[var(--color-bg-1)]/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-4 px-6">
          <Link href="/v2" className="flex items-center gap-3" aria-label="HARIS başlangıç">
            <span className="font-serif text-xl font-bold tracking-wide text-[var(--color-gold)]">HARIS</span>
            <span className="hidden text-xs uppercase tracking-widest text-[var(--color-text-3)] sm:inline">
              Dava Çalışma Alanı
            </span>
          </Link>
          <div className="flex min-w-0 items-center gap-5 text-sm">
            <nav aria-label="Ana gezinme" className="hidden md:block">
              <ul className="flex items-center gap-5">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[var(--color-text-2)] transition hover:text-[var(--color-gold-bright)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <UsageMeter />
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}

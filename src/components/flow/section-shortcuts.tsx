import Link from "next/link";
import {
  BarChart3,
  Calendar,
  Folder,
  Library,
  Search,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

interface Shortcut {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const SECTION_SHORTCUTS: Shortcut[] = [
  { href: "/research", label: "İçtihat araştırma", description: "Karar ve mevzuat arayın", icon: Search },
  { href: "/library", label: "Şablon kütüphanesi", description: "Hazır dilekçe örnekleri", icon: Library },
  { href: "/calendar", label: "Takvim & süreler", description: "Duruşma ve süre takibi", icon: Calendar },
  { href: "/cases", label: "Klasik davalar", description: "Önceki dava kayıtları", icon: Folder },
  { href: "/agents", label: "AI ajan paneli", description: "Ajanların canlı durumu", icon: Users },
  { href: "/v2/analytics", label: "Maliyet & analitik", description: "Kullanım ve harcama", icon: BarChart3 },
  { href: "/settings", label: "Ayarlar", description: "Hesap ve tercihler", icon: Settings },
];

export function SectionShortcuts() {
  return (
    <section aria-labelledby="shortcuts-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="shortcuts-title" className="font-sans text-sm font-semibold text-[var(--color-text)]">
          Doğrudan geçiş
        </h2>
        <p className="text-[13px] text-[var(--color-text-3)]">
          Akışı beklemeden istediğiniz bölüme gidebilirsiniz.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SECTION_SHORTCUTS.map(({ href, label, description, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-full items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-1)] p-3.5 transition hover:border-[var(--color-gold)]/40 hover:bg-[var(--color-bg-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-3)] text-[var(--color-gold-bright)]">
                <Icon size={16} aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-medium text-[var(--color-text)]">{label}</span>
                <span className="truncate text-[11.5px] text-[var(--color-text-3)]">{description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

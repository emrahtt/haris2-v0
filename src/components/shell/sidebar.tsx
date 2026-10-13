"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { signOut } from "@/lib/auth-actions";
import { DEMO_USER } from "@/lib/supabase/config";
import {
  Compass,
  Home,
  Folder,
  Users,
  Calendar,
  Library,
  Search,
  Settings,
  LogOut,
  CreditCard,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Ana",
    items: [
      { href: "/v2", label: "Başlangıç", icon: Compass },
      { href: "/dashboard", label: "Gösterge Paneli", icon: Home },
      { href: "/cases", label: "Davalarım", icon: Folder, badge: "6" },
      { href: "/agents", label: "AI Ajan Paneli", icon: Users, badge: "Canlı" },
    ],
  },
  {
    label: "Çalışma",
    items: [
      { href: "/calendar", label: "Takvim & Süreler", icon: Calendar, badge: "3" },
      { href: "/library", label: "Şablon Kütüphanesi", icon: Library },
      { href: "/research", label: "İçtihat Araştırma", icon: Search },
    ],
  },
  {
    label: "Hesap",
    items: [
      { href: "/settings", label: "Ayarlar", icon: Settings },
      { href: "/pricing", label: "Plan & Yükselt", icon: CreditCard },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex bg-[var(--color-bg-1)] border-r border-[var(--color-line)] px-4 py-5 flex-col sticky top-0 h-screen overflow-y-auto w-[260px]">
      <div className="px-2 pb-5 border-b border-[var(--color-line)] mb-4">
        <Link href="/v2" aria-label="HARIS başlangıç">
          <Logo size="sm" />
        </Link>
      </div>

      <nav className="flex-1">
        {SECTIONS.map((section) => (
          <div key={section.label} className="mb-5">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-3)] px-3 pb-2.5">
              {section.label}
            </div>
            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-all mb-0.5 ${
                    isActive
                      ? "bg-gradient-to-r from-[var(--color-gold)]/15 to-[var(--color-gold)]/[0.02] text-[var(--color-gold-bright)] border-l-2 border-[var(--color-gold)] pl-2.5"
                      : "text-[var(--color-text-2)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <Icon size={16} strokeWidth={1.8} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-xl ${
                        item.badge === "Canlı"
                          ? "bg-[var(--color-ok)]/15 text-[var(--color-ok)]"
                          : "bg-[var(--color-bg-3)] text-[var(--color-text-2)]"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <form action={signOut} className="mt-auto pt-5 border-t border-[var(--color-line)]">
        <div className="flex items-center gap-2.5 p-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-gold)] to-[var(--color-gold-soft)] text-[var(--color-bg-deep)] flex items-center justify-center font-semibold text-[13px] flex-shrink-0">
            {DEMO_USER.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] text-[var(--color-text)] font-medium truncate">
              {DEMO_USER.name}
            </div>
            <div className="text-[10.5px] text-[var(--color-text-3)] truncate">
              {DEMO_USER.firmName} • {DEMO_USER.plan}
            </div>
          </div>
          <button
            type="submit"
            title="Çıkış"
            className="text-[var(--color-text-3)] hover:text-[var(--color-danger)] cursor-pointer p-1"
          >
            <LogOut size={14} />
          </button>
        </div>
      </form>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import type { AdminUser } from "@/lib/admin/auth";
import {
  LayoutDashboard,
  Shield,
  FileSearch,
  Trash2,
  UserCog,
  Database,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";

const NAV = [
  { href: "/admin/dashboard", label: "Genel Bakış", icon: LayoutDashboard },
  { href: "/admin/kvkk-requests", label: "KVKK Başvuruları", icon: Shield, badge: "deadline" },
  { href: "/admin/audit-logs", label: "Audit Logları", icon: FileSearch },
  { href: "/admin/deletions", label: "Hesap Silme Kuyruğu", icon: Trash2 },
  { href: "/admin/users", label: "Kullanıcılar", icon: UserCog },
  { href: "/admin/scraping", label: "Yargıtay Scraping", icon: Database },
  { href: "/admin/ai-cost", label: "AI Maliyet", icon: Database },
];

export function AdminShell({
  children,
  admin,
  pendingKvkkCount,
}: {
  children: React.ReactNode;
  admin: AdminUser;
  pendingKvkkCount?: number;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="hidden md:flex bg-[var(--color-bg-1)] border-r border-[var(--color-line)] px-4 py-5 flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="px-2 pb-5 border-b border-[var(--color-line)] mb-4">
          <Link href="/dashboard">
            <Logo size="sm" />
          </Link>
          <div className="mt-3 px-1 text-[11px] uppercase tracking-wider">
            <span className="text-[var(--color-danger)] font-semibold">ADMIN PANEL</span>
            <span className="text-[var(--color-text-3)]"> · {admin.adminRole}</span>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5">
          {NAV.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-[var(--color-gold)]/15 to-[var(--color-gold)]/[0.02] text-[var(--color-gold-bright)] border-l-2 border-[var(--color-gold)] pl-2.5"
                    : "text-[var(--color-text-2)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-text)]"
                }`}
              >
                <Icon size={16} strokeWidth={1.8} />
                <span className="flex-1">{item.label}</span>
                {item.badge === "deadline" && pendingKvkkCount && pendingKvkkCount > 0 && (
                  <span className="bg-[var(--color-danger)]/20 text-[var(--color-danger)] text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                    {pendingKvkkCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-[var(--color-line)]">
          <div className="text-[11px] text-[var(--color-text-3)] px-2 mb-2">
            {admin.fullName}
            <br />
            <span className="text-[10px]">{admin.email}</span>
          </div>
          <Link
            href="/v2"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-[12px] text-[var(--color-text-2)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-text)]"
          >
            <ArrowLeft size={14} />
            Uygulamaya dön
          </Link>
        </div>
      </aside>

      <div className="px-5 py-6 md:px-9 md:py-7 min-w-0">
        {/* Demo mode banner */}
        <DemoModeBanner />

        {children}
      </div>
    </div>
  );
}

function DemoModeBanner() {
  // İlk yüklemede tek seferlik göster
  return (
    <div className="mb-6 bg-[var(--color-warn)]/10 border border-[var(--color-warn)]/30 rounded-lg p-3 flex items-start gap-2 text-[12px]">
      <AlertCircle size={14} className="text-[var(--color-warn)] flex-shrink-0 mt-0.5" />
      <div>
        <strong className="text-[var(--color-warn)]">Admin Panel — Hassas Bölge</strong>
        <br />
        <span className="text-[var(--color-text-2)]">
          Burada gördüğünüz her veri kişisel veridir. KVKK m.12 gereği tüm eylemleriniz
          loglanır. <strong>Yetkisiz erişim suçtur</strong> (TCK m.136-138).
        </span>
      </div>
    </div>
  );
}

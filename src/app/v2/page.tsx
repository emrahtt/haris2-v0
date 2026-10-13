/**
 * HARIS — Başlangıç (tek giriş noktası)
 * Kullanıcıya önce "sıradaki adım"ı, sonra dosyalarını, en sonda
 * doğrudan geçiş kısayollarını gösterir.
 */

import Link from "next/link";
import { Plus } from "lucide-react";
import { getCurrentUserId } from "@/lib/v2/workspace/auth";
import { listWorkspaces } from "@/lib/v2/workspace/db";
import { isDemoMode } from "@/lib/supabase/config";
import { resolveHomeAction, resolveWorkspaceAction, NEW_WORKSPACE_HREF } from "@/lib/flow/steps";
import { NextStepCard } from "@/components/flow/next-step-card";
import { SectionShortcuts } from "@/components/flow/section-shortcuts";

export const dynamic = "force-dynamic";

function formatRelativeTr(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}

const STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  completed: "Tamamlandı",
  archived: "Arşiv",
  draft: "Taslak",
};

export default async function V2Home() {
  const userId = await getCurrentUserId();
  const workspaces = await listWorkspaces(userId);
  const { action, workspaceId } = resolveHomeAction(workspaces);
  const currentWorkspace = workspaces.find((w) => w.id === workspaceId);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-balance font-serif text-3xl text-[var(--color-text)] md:text-4xl">
          {workspaces.length === 0 ? "Hoş geldiniz" : "Kaldığınız yerden devam edin"}
        </h1>
        <p className="max-w-2xl text-pretty leading-relaxed text-[var(--color-text-2)]">
          Her dava beş adımda ilerler: dosya açın, belgeleri ekleyin, analizi başlatın,
          dilekçeyi inceleyin ve süreleri takip edin. HARIS size her seferinde sıradaki adımı gösterir.
        </p>
      </header>

      <NextStepCard action={action} workspaceTitle={currentWorkspace?.title} />

      <section aria-labelledby="workspaces-title" className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <h2 id="workspaces-title" className="font-sans text-sm font-semibold text-[var(--color-text)]">
            Dava dosyalarınız{" "}
            <span className="font-normal text-[var(--color-text-3)]">({workspaces.length})</span>
          </h2>
          {workspaces.length > 0 && (
            <Link
              href={NEW_WORKSPACE_HREF}
              className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-gold-bright)] hover:underline"
            >
              <Plus size={14} aria-hidden /> Yeni dosya
            </Link>
          )}
        </div>

        {workspaces.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--color-line-2)] px-6 py-10 text-center text-sm text-[var(--color-text-3)]">
            Henüz dosyanız yok. Yukarıdaki &ldquo;Yeni dosya aç&rdquo; ile ilk davanızı oluşturun.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {workspaces.map((w) => {
              const next = resolveWorkspaceAction({ id: w.id, orchestrationStatus: w.orchestration_status });
              return (
                <li key={w.id}>
                  <Link
                    href={`/v2/workspaces/${w.id}`}
                    className="flex h-full flex-col gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-1)] p-5 transition hover:border-[var(--color-gold)]/40 hover:bg-[var(--color-bg-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-sans text-[14.5px] font-semibold text-[var(--color-text)]">{w.title}</h3>
                      <span className="shrink-0 rounded-full border border-[var(--color-line-2)] px-2 py-0.5 text-[11px] text-[var(--color-text-2)]">
                        {STATUS_LABEL[w.status] ?? w.status}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-[var(--color-gold-bright)]">Sıradaki: {next.title}</p>
                    <div className="mt-auto flex items-center gap-2 text-[11.5px] text-[var(--color-text-3)]">
                      {w.case_type && <span>{w.case_type}</span>}
                      {w.case_type && <span aria-hidden>·</span>}
                      <span>{formatRelativeTr(w.updated_at)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <SectionShortcuts />

      {isDemoMode && (
        <p className="rounded-lg border border-[var(--color-warn)]/25 bg-[var(--color-warn)]/5 p-4 text-xs text-[var(--color-warn)]">
          <strong>Demo modu aktif:</strong> Supabase ortam değişkenleri tanımlı değil, geçici örnek veri gösteriliyor.
        </p>
      )}
    </div>
  );
}

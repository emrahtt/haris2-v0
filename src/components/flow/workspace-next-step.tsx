"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FlowStepper } from "@/components/flow/flow-stepper";
import { resolveWorkspaceAction } from "@/lib/flow/steps";

interface Props {
  workspaceId: string;
  orchestrationStatus: string;
  documentsCount: number;
  hasPetition: boolean;
  onAddDocuments: () => void;
  onStart: () => void;
  onOpenCheckpoint?: () => void;
}

const BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-md bg-[var(--color-gold)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-bg-deep)] transition hover:bg-[var(--color-gold-bright)] disabled:cursor-not-allowed disabled:opacity-60";

/** Çalışma alanı içinde akışın neresinde olunduğunu ve tek bir sonraki eylemi gösterir. */
export function WorkspaceNextStep({
  workspaceId,
  orchestrationStatus,
  documentsCount,
  hasPetition,
  onAddDocuments,
  onStart,
  onOpenCheckpoint,
}: Props) {
  const action = resolveWorkspaceAction({
    id: workspaceId,
    orchestrationStatus,
    documentsCount,
    hasPetition,
  });

  const renderAction = () => {
    if (documentsCount === 0) {
      return (
        <button type="button" onClick={onAddDocuments} className={BUTTON_CLASS}>
          Belge ekle <ArrowRight size={13} aria-hidden />
        </button>
      );
    }
    switch (orchestrationStatus) {
      case "running":
        return (
          <span className="text-[11.5px] text-[var(--color-ok)]">Ajanlar çalışıyor…</span>
        );
      case "paused_for_user":
        return onOpenCheckpoint ? (
          <button type="button" onClick={onOpenCheckpoint} className={BUTTON_CLASS}>
            Kararı ver <ArrowRight size={13} aria-hidden />
          </button>
        ) : (
          <span className="text-[11.5px] text-[var(--color-warn)]">Kararınız bekleniyor</span>
        );
      case "completed":
        return (
          <Link href="/calendar" className={BUTTON_CLASS}>
            Süreleri takvime işle <ArrowRight size={13} aria-hidden />
          </Link>
        );
      case "error":
        return (
          <button type="button" onClick={onStart} className={BUTTON_CLASS}>
            Yeniden başlat <ArrowRight size={13} aria-hidden />
          </button>
        );
      default:
        return (
          <button type="button" onClick={onStart} className={BUTTON_CLASS}>
            Analizi başlat <ArrowRight size={13} aria-hidden />
          </button>
        );
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-4">
      <FlowStepper current={action.step} compact className="hidden xl:block" />
      <p className="hidden max-w-56 truncate text-[11.5px] text-[var(--color-text-2)] lg:block" title={action.description}>
        <span className="text-[var(--color-text-3)]">Sıradaki:</span> {action.title}
      </p>
      {renderAction()}
    </div>
  );
}

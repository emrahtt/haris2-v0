import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { getCurrentUserId } from "@/lib/v2/workspace/auth";
import { listWorkspaces } from "@/lib/v2/workspace/db";
import { OPEN_CASE_ACTION, resolveHomeAction, type NextAction } from "@/lib/flow/steps";

async function loadNextAction(): Promise<NextAction> {
  try {
    const userId = await getCurrentUserId();
    const workspaces = await listWorkspaces(userId);
    return resolveHomeAction(workspaces).action;
  } catch {
    return OPEN_CASE_ACTION;
  }
}

/** Klasik sayfalarda kullanıcıyı ana akışa bağlayan ince şerit. */
export async function NextStepBanner() {
  const action = await loadNextAction();

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-1)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-gold)]/12 text-[var(--color-gold-bright)]">
          <Compass size={16} aria-hidden />
        </span>
        <p className="min-w-0 text-[13px] leading-relaxed text-[var(--color-text-2)]">
          <span className="font-medium text-[var(--color-gold-bright)]">Sıradaki adım:</span>{" "}
          <span className="text-[var(--color-text)]">{action.title}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <Link href="/v2" className="text-[12.5px] text-[var(--color-text-3)] hover:text-[var(--color-text)]">
          Başlangıca dön
        </Link>
        <Link
          href={action.href}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-gold)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--color-bg-deep)] hover:bg-[var(--color-gold-bright)]"
        >
          {action.cta}
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

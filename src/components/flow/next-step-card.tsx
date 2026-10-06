import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FlowStepper } from "@/components/flow/flow-stepper";
import type { NextAction } from "@/lib/flow/steps";

interface Props {
  action: NextAction;
  workspaceTitle?: string;
}

const TONE_STYLES: Record<NextAction["tone"], { eyebrow: string; border: string }> = {
  default: { eyebrow: "text-[var(--color-gold-bright)]", border: "border-[var(--color-gold)]/35" },
  attention: { eyebrow: "text-[var(--color-warn)]", border: "border-[var(--color-warn)]/40" },
  progress: { eyebrow: "text-[var(--color-ok)]", border: "border-[var(--color-ok)]/35" },
};

export function NextStepCard({ action, workspaceTitle }: Props) {
  const tone = TONE_STYLES[action.tone];

  return (
    <section
      aria-labelledby="next-step-title"
      className={`flex flex-col gap-6 rounded-2xl border bg-[var(--color-bg-1)] p-6 md:p-8 ${tone.border}`}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <p className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${tone.eyebrow}`}>
            {action.tone === "progress" && (
              <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-ok)]" />
            )}
            Sıradaki adım
          </p>
          <h2 id="next-step-title" className="text-balance font-serif text-2xl text-[var(--color-text)] md:text-3xl">
            {action.title}
          </h2>
          {workspaceTitle && (
            <p className="truncate text-sm text-[var(--color-text-2)]">
              Dosya: <span className="text-[var(--color-text)]">{workspaceTitle}</span>
            </p>
          )}
          <p className="max-w-xl text-pretty text-sm leading-relaxed text-[var(--color-text-2)]">
            {action.description}
          </p>
        </div>

        <Link
          href={action.href}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--color-gold)] px-5 py-3 text-sm font-semibold text-[var(--color-bg-deep)] transition hover:bg-[var(--color-gold-bright)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold-bright)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-1)]"
        >
          {action.cta}
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>

      <div className="border-t border-[var(--color-line)] pt-5">
        <FlowStepper current={action.step} />
      </div>
    </section>
  );
}

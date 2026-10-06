import { Check } from "lucide-react";
import { FLOW_STEPS, stepIndex, type FlowStepId } from "@/lib/flow/steps";

interface Props {
  current: FlowStepId;
  compact?: boolean;
  className?: string;
}

export function FlowStepper({ current, compact = false, className = "" }: Props) {
  const currentIdx = stepIndex(current);

  return (
    <nav aria-label="İş akışı adımları" className={className}>
      <ol className={`flex items-center ${compact ? "gap-1.5" : "gap-2"}`}>
        {FLOW_STEPS.map((step, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          const isLast = idx === FLOW_STEPS.length - 1;

          return (
            <li
              key={step.id}
              aria-current={active ? "step" : undefined}
              className={`flex items-center ${compact ? "gap-1.5" : "gap-2"} ${
                isLast ? "" : "flex-1"
              }`}
            >
              <span
                className={`flex shrink-0 items-center justify-center rounded-full border font-semibold ${
                  compact ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs"
                } ${
                  done
                    ? "border-[var(--color-gold)] bg-[var(--color-gold)] text-[var(--color-bg-deep)]"
                    : active
                      ? "border-[var(--color-gold)] text-[var(--color-gold-bright)] ring-4 ring-[var(--color-gold)]/15"
                      : "border-[var(--color-line-2)] text-[var(--color-text-3)]"
                }`}
              >
                {done ? <Check size={compact ? 11 : 14} strokeWidth={3} aria-hidden /> : idx + 1}
              </span>
              <span
                className={`whitespace-nowrap ${
                  compact
                    ? active
                      ? "text-[11px] text-[var(--color-gold-bright)]"
                      : "sr-only"
                    : `hidden text-[12.5px] lg:inline ${
                        active
                          ? "font-medium text-[var(--color-text)]"
                          : done
                            ? "text-[var(--color-text-2)]"
                            : "text-[var(--color-text-3)]"
                      }`
                }`}
              >
                {step.label}
                {done && <span className="sr-only"> (tamamlandı)</span>}
              </span>
              {!isLast && (
                <span
                  aria-hidden
                  className={`h-px flex-1 ${compact ? "min-w-2" : "min-w-4"} ${
                    done ? "bg-[var(--color-gold)]/60" : "bg-[var(--color-line-2)]"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

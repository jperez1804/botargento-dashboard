import { cn } from "@/lib/utils";
import type { CrmStageTone } from "@/config/verticals/_types";

// Semantic stage palette (domain meaning, not brand): neutral for untouched,
// info for bot-driven progress, warning-family for hands-on stages, positive
// for won, danger for lost.
const TONE_CLASS: Record<CrmStageTone, string> = {
  neutral: "bg-[var(--neutral-soft)] text-[var(--muted-ink)]",
  info: "bg-[var(--info-soft)] text-[var(--info)]",
  progress:
    "bg-[var(--warning-soft)] text-[color-mix(in_oklch,var(--warning)_65%,var(--ink))]",
  good: "bg-[var(--positive-soft)] text-[var(--positive)]",
  bad: "bg-[var(--danger-soft)] text-[var(--danger)]",
};

type Props = {
  label: string;
  tone: CrmStageTone;
  // Automatic (derived) stages render with a dashed ring so a person can tell
  // "the bot says so" from "someone decided".
  auto?: boolean;
  autoTitle?: string;
  className?: string;
};

export function LeadStageChip({ label, tone, auto, autoTitle, className }: Props) {
  return (
    <span
      data-stage-chip
      title={auto ? autoTitle : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-full text-[11.5px] font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        auto &&
          "outline-1 outline-dashed outline-offset-[-1px] outline-[color-mix(in_oklch,currentColor_45%,transparent)]",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

import { Bot } from "lucide-react";
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
  // Automatic (derived) stages carry a small bot glyph so a person can tell
  // "the bot says so" from "someone decided". (A dashed ring was too faint.)
  auto?: boolean;
  autoTitle?: string;
  className?: string;
};

export function LeadStageChip({ label, tone, auto, autoTitle, className }: Props) {
  return (
    <span
      data-stage-chip
      data-stage-auto={auto ? "" : undefined}
      title={auto ? autoTitle : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-full text-[11.5px] font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {auto ? (
        <Bot className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

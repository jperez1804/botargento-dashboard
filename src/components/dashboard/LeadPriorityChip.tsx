import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PriorityTone } from "@/lib/crm/priority";

// Manual priority pill: danger for alta, warning for media, neutral for baja.
// Rendered only when a priority is set — "none" is silence, not a chip.
const TONE_CLASS: Record<PriorityTone, string> = {
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  warning: "bg-[var(--warning-soft)] text-[color-mix(in_oklch,var(--warning)_65%,var(--ink))]",
  neutral: "bg-[var(--neutral-soft)] text-[var(--muted-ink)]",
};

type Props = { label: string; tone: PriorityTone; className?: string };

export function LeadPriorityChip({ label, tone, className }: Props) {
  return (
    <span
      data-testid="lead-priority"
      data-priority-tone={tone}
      className={cn(
        "inline-flex h-[18px] items-center gap-1 rounded-full px-1.5 text-[10.5px] font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      <Flag className="size-2.5" aria-hidden />
      {label}
    </span>
  );
}

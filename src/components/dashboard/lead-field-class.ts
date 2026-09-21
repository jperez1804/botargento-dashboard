import type { CrmStageTone } from "@/config/verticals/_types";

// Shared input/select styling for the CRM lead controls (native elements:
// accessible, mobile-friendly, and trivially drivable from Playwright).
export const LEAD_FIELD_CLASS =
  "h-8 w-full rounded-md border border-[var(--rule-strong)] bg-[var(--surface)] px-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--soft-ink)] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)]";

export const LEAD_CAPTION_CLASS =
  "block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)]";

// Stage tone → solid dot color (board column headers, donut legend). Keep in
// step with the soft chip palette in LeadStageChip.
export const STAGE_DOT_CLASS: Record<CrmStageTone, string> = {
  neutral: "bg-[var(--faint-ink)]",
  info: "bg-[var(--info)]",
  progress: "bg-[var(--warning)]",
  good: "bg-[var(--positive)]",
  bad: "bg-[var(--danger)]",
};

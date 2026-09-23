import type { CrmStageTone } from "@/config/verticals/_types";

// Shared input/select styling for the CRM lead controls (native elements:
// accessible, mobile-friendly, and trivially drivable from Playwright).
export const LEAD_FIELD_CLASS =
  "h-8 w-full rounded-md border border-[var(--rule-strong)] bg-[var(--surface)] px-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--soft-ink)] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)]";

// Toggle chips (reminder presets, activity kind): the chosen one is filled
// the same soft way as the /leads filter chips.
export const TOGGLE_CHIP_CLASS =
  "inline-flex h-6 cursor-pointer items-center rounded-full border border-[var(--rule-strong)] bg-[var(--surface)] px-2 text-[11.5px] font-medium text-[var(--muted-ink)] transition-colors duration-150 hover:border-[var(--ink)] hover:text-[var(--ink)] disabled:cursor-default disabled:opacity-60 aria-pressed:border-[color-mix(in_oklch,var(--client-primary)_55%,var(--rule))] aria-pressed:bg-[color-mix(in_oklch,var(--client-primary)_12%,var(--surface))] aria-pressed:font-semibold aria-pressed:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-1";

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

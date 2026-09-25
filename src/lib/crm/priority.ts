// Manual lead priority — a person's mark, never derived by the bot. Keys are
// persisted in dashboard.opportunities.priority; labels come from the vertical's
// CrmLabels so each vertical words them its own way. Pure module.

import type { CrmLabels, CrmPriorityKey } from "@/config/verticals/_types";

export const PRIORITY_KEYS: ReadonlyArray<CrmPriorityKey> = ["alta", "media", "baja"];

export type PriorityTone = "danger" | "warning" | "neutral";

export const PRIORITY_TONE: Record<CrmPriorityKey, PriorityTone> = {
  alta: "danger",
  media: "warning",
  baja: "neutral",
};

/** '' , unknown or malformed → null; keys are matched case-insensitively. */
export function parsePriority(raw: unknown): CrmPriorityKey | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  return (PRIORITY_KEYS as ReadonlyArray<string>).includes(key) ? (key as CrmPriorityKey) : null;
}

/** Sort rank: alta 0 · media 1 · baja 2 · none 3 (lower comes first). */
export function priorityRank(key: CrmPriorityKey | null): number {
  const i = key === null ? -1 : PRIORITY_KEYS.indexOf(key);
  return i === -1 ? PRIORITY_KEYS.length : i;
}

export type PriorityView = { key: CrmPriorityKey; label: string; tone: PriorityTone };

export function priorityView(key: CrmPriorityKey | null, labels: CrmLabels): PriorityView | null {
  if (key === null) return null;
  return { key, label: labels.priority.names[key], tone: PRIORITY_TONE[key] };
}

/** The three levels in rank order, for selects and menus. */
export function priorityOptions(labels: CrmLabels): ReadonlyArray<PriorityView> {
  return PRIORITY_KEYS.map((key) => ({ key, label: labels.priority.names[key], tone: PRIORITY_TONE[key] }));
}

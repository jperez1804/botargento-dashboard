// How a lead_events row reads to a person — shared by the lead card's history
// and the team-wide Actividad feed so both say exactly the same thing.
// System events render their structured detail from metadata; activities a
// person logged render their own text.

import type { CrmConfig, CrmEventKind } from "@/config/verticals/_types";

export type DescribableEvent = {
  kind: string;
  body: string;
  metadata: Record<string, unknown>;
};

/** "Nota", "Cambio de etapa"… — falls back to the raw kind for unknown ones. */
export function eventKindLabel(config: CrmConfig, kind: string): string {
  return config.labels.eventKinds[kind as CrmEventKind] ?? kind;
}

/** The line under the kind: "Calificado → Visita", "→ Ana Asesora", the note… */
export function describeLeadEvent(
  event: DescribableEvent,
  config: CrmConfig,
  memberLabel: (email: string | null) => string,
): string {
  const meta = event.metadata;
  const stageLabel = (key: unknown) =>
    config.stages.find((s) => s.key === key)?.label ?? (typeof key === "string" ? key : "—");

  if (event.kind === "stage_change") {
    if (typeof meta.to !== "string") return event.body;
    const move = meta.from ? `${stageLabel(meta.from)} → ${stageLabel(meta.to)}` : `→ ${stageLabel(meta.to)}`;
    return event.body ? `${move} · ${event.body}` : move;
  }
  if (event.kind === "assignment") {
    if (!("to" in meta)) return event.body;
    const to = typeof meta.to === "string" ? memberLabel(meta.to) : config.labels.unassigned;
    return `→ ${to}`;
  }
  if (event.kind === "created") {
    const source = config.manualLeadSources.find((s) => s.key === meta.source)?.label;
    return source ? `${config.labels.sourceLabel}: ${source}` : event.body;
  }
  return event.body;
}

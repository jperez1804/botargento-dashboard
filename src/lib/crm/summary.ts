// View-model for the Resumen tab: Jira "Summary"-style indicators over the
// rows listLeads already derives. Fixed 7-day window. Pure: no DB, no clock —
// `now` is an argument, labels come from the vertical config.
//
// Populations: Etapas and Origen describe every lead (lost included);
// Prioridad and Carga del equipo describe what is still being worked (open =
// non-terminal stage).

import type { CrmConfig, CrmPriorityKey, CrmStageTone } from "@/config/verticals/_types";
import type { EffectiveLead } from "@/lib/crm/effective-stage";
import { PRIORITY_KEYS, PRIORITY_TONE, type PriorityTone } from "@/lib/crm/priority";
import type { LeadRow } from "@/lib/queries/leads";

export const SUMMARY_WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

export type SummaryRow = { key: string; label: string; count: number; pct: number }; // pct 0..1
export type SummaryStageSlice = SummaryRow & { tone: CrmStageTone };
export type SummaryPriorityRow = SummaryRow & { tone: PriorityTone | "none" };

export type LeadsSummary = {
  windowDays: number;
  kpis: { closed: number; active: number; new: number; dueSoon: number; overdue: number };
  stages: { total: number; slices: SummaryStageSlice[] }; // config order, lost included
  priorities: { total: number; rows: SummaryPriorityRow[] }; // open leads; alta, media, baja, none
  workload: { total: number; rows: SummaryRow[] }; // open leads; "" = unassigned, first
  sources: { total: number; rows: SummaryRow[] }; // "whatsapp" + manualLeadSources keys
};

// Structural subset of TeamMember so this module stays free of the DB layer.
export type SummaryTeamMember = { email: string; displayName: string; role: string; active: boolean };

/** Terminal stages other than the lost one — where a "won" lead ends up. */
export function closedStageKeys(config: CrmConfig): string[] {
  return config.stages
    .filter((s) => s.terminal && s.key !== config.autoStages.lost)
    .map((s) => s.key);
}

export function isOpenLead(lead: EffectiveLead, config: CrmConfig): boolean {
  return config.stages.find((s) => s.key === lead.stage)?.terminal !== true;
}

const pctOf = (count: number, total: number) => (total > 0 ? count / total : 0);

export function buildLeadsSummary(
  rows: ReadonlyArray<LeadRow>,
  config: CrmConfig,
  team: ReadonlyArray<SummaryTeamMember>,
  now: Date,
  windowDays = SUMMARY_WINDOW_DAYS,
): LeadsSummary {
  const labels = config.labels;
  const since = now.getTime() - windowDays * DAY_MS;
  const until = now.getTime() + windowDays * DAY_MS;
  const closedKeys = new Set(closedStageKeys(config));
  const open = rows.filter((r) => isOpenLead(r.lead, config));

  const kpis = {
    closed: rows.filter(
      (r) => closedKeys.has(r.lead.stage) && r.lead.stageSince !== null && r.lead.stageSince.getTime() >= since,
    ).length,
    active: rows.filter((r) => r.lead.lastActivityAt !== null && r.lead.lastActivityAt.getTime() >= since)
      .length,
    new: rows.filter((r) => r.firstSeen !== null && r.firstSeen.getTime() >= since).length,
    dueSoon: rows.filter((r) => {
      const rem = r.lead.reminder;
      return (
        rem !== null &&
        (rem.status === "upcoming" || rem.status === "scheduled") &&
        rem.at.getTime() <= until
      );
    }).length,
    overdue: rows.filter((r) => r.lead.reminder?.status === "overdue").length,
  };

  const stageCount = new Map<string, number>();
  for (const r of rows) stageCount.set(r.lead.stage, (stageCount.get(r.lead.stage) ?? 0) + 1);
  const stages = {
    total: rows.length,
    slices: config.stages.map((s) => {
      const count = stageCount.get(s.key) ?? 0;
      return { key: s.key, label: s.label, tone: s.tone, count, pct: pctOf(count, rows.length) };
    }),
  };

  const priorityCount = new Map<CrmPriorityKey | "none", number>();
  for (const r of open) {
    const k = r.lead.priority ?? "none";
    priorityCount.set(k, (priorityCount.get(k) ?? 0) + 1);
  }
  const priorities = {
    total: open.length,
    rows: [
      ...PRIORITY_KEYS.map((key) => ({
        key,
        label: labels.priority.names[key],
        tone: PRIORITY_TONE[key],
        count: priorityCount.get(key) ?? 0,
        pct: pctOf(priorityCount.get(key) ?? 0, open.length),
      })),
      {
        key: "none",
        label: labels.priority.none,
        tone: "none" as const,
        count: priorityCount.get("none") ?? 0,
        pct: pctOf(priorityCount.get("none") ?? 0, open.length),
      },
    ],
  };

  // Unassigned first, then everyone who can own a lead (0 counts included, so
  // an idle asesor shows as idle), then any other owner still holding leads.
  const ownerCount = new Map<string, number>();
  for (const r of open) {
    const k = r.lead.owner ?? "";
    ownerCount.set(k, (ownerCount.get(k) ?? 0) + 1);
  }
  const members = team.filter((m) => m.role !== "viewer" && m.active);
  const memberEmails = new Set(members.map((m) => m.email));
  const others = [...ownerCount.keys()].filter((k) => k !== "" && !memberEmails.has(k)).sort();
  const ownerLabel = (email: string) => team.find((m) => m.email === email)?.displayName || email;
  const workloadRow = (key: string, label: string) => ({
    key,
    label,
    count: ownerCount.get(key) ?? 0,
    pct: pctOf(ownerCount.get(key) ?? 0, open.length),
  });
  const workload = {
    total: open.length,
    rows: [
      workloadRow("", labels.unassigned),
      ...members.map((m) => workloadRow(m.email, m.displayName || m.email)),
      ...others.map((email) => workloadRow(email, ownerLabel(email))),
    ],
  };

  const sourceCount = new Map<string, number>();
  for (const r of rows) {
    const k = r.manual?.source ?? "whatsapp";
    sourceCount.set(k, (sourceCount.get(k) ?? 0) + 1);
  }
  const sourceDefs = [
    { key: "whatsapp", label: labels.sourceWhatsapp },
    ...config.manualLeadSources,
  ];
  const sources = {
    total: rows.length,
    rows: sourceDefs.map((s) => ({
      key: s.key,
      label: s.label,
      count: sourceCount.get(s.key) ?? 0,
      pct: pctOf(sourceCount.get(s.key) ?? 0, rows.length),
    })),
  };

  return { windowDays, kpis, stages, priorities, workload, sources };
}

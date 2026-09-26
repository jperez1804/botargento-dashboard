// What a lead needs from a person right now, as ONE line with a fixed
// precedence — the board card shows it on top and columns sort by it:
//   overdue reminder → reminder due today → about to be lost → reminder due
//   within warnDays → nothing. Lost leads carry their reason and sort last.
// Pure: `now` and the tenant timezone are arguments.

import type { CrmLabels } from "@/config/verticals/_types";
import type { EffectiveLead } from "@/lib/crm/effective-stage";
import { fillTemplate, formatDay, formatRelative } from "@/lib/crm/view-model";

export type AttentionKind = "overdue" | "today" | "at_risk" | "upcoming" | "lost";
export type AttentionTone = "danger" | "warning" | "neutral";
export type Attention = { kind: AttentionKind; rank: number; tone: AttentionTone; text: string };

const RANK: Record<AttentionKind, number> = { overdue: 0, today: 1, at_risk: 2, upcoming: 3, lost: 5 };
export const NO_ATTENTION_RANK = 4;
const TONE: Record<AttentionKind, AttentionTone> = {
  overdue: "danger",
  today: "warning",
  at_risk: "warning",
  upcoming: "neutral",
  lost: "neutral",
};

function dayKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatTime(date: Date, locale: string, timezone: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).format(date);
}

export function attentionKind(lead: EffectiveLead, now: Date, timezone: string): AttentionKind | null {
  if (lead.lost) return "lost";
  const rem = lead.reminder && lead.reminder.status !== "done" ? lead.reminder : null;
  if (rem?.status === "overdue") return "overdue";
  if (rem && dayKey(rem.at, timezone) === dayKey(now, timezone)) return "today";
  if (lead.atRisk) return "at_risk";
  if (rem?.status === "upcoming") return "upcoming";
  return null;
}

/** Sort key: lower comes first; leads with nothing pending sit at 4, lost at 5. */
export function attentionRank(lead: EffectiveLead, now: Date, timezone: string): number {
  const kind = attentionKind(lead, now, timezone);
  return kind ? RANK[kind] : NO_ATTENTION_RANK;
}

export function leadAttention(
  lead: EffectiveLead,
  labels: CrmLabels,
  locale: string,
  timezone: string,
  now: Date,
): Attention | null {
  const kind = attentionKind(lead, now, timezone);
  if (!kind) return null;
  const rem = lead.reminder;
  const withNote = (text: string) => (rem?.note ? `${text} · ${rem.note}` : text);
  let text: string;
  switch (kind) {
    case "overdue":
      text = withNote(
        fillTemplate(labels.attentionOverdueTemplate, { relative: formatRelative(rem!.at, now, locale, timezone) }),
      );
      break;
    case "today":
      text = withNote(fillTemplate(labels.attentionTodayTemplate, { time: formatTime(rem!.at, locale, timezone) }));
      break;
    case "at_risk":
      text = fillTemplate(labels.attentionAtRiskTemplate, { date: formatDay(lead.atRisk!.lostOn, locale, timezone) });
      break;
    case "upcoming":
      text = withNote(
        fillTemplate(labels.attentionUpcomingTemplate, { relative: formatRelative(rem!.at, now, locale, timezone) }),
      );
      break;
    case "lost": {
      const reason =
        lead.lost!.reason === "manual" ? lead.lost!.detail || "" : labels.lostReasonAuto[lead.lost!.reason];
      text = fillTemplate(labels.lostSinceTemplate, {
        date: formatDay(lead.lost!.at, locale, timezone),
        reason: reason || labels.stageLabel,
      });
      break;
    }
  }
  return { kind, rank: RANK[kind], tone: TONE[kind], text };
}

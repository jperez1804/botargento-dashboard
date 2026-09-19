// Display model for a derived lead: stage chip, status line ("pasa a perdido
// el…", "perdido desde…"), owner label and reminder text. Shared by the lead
// card, the /leads table and the board so every surface words a lead the same
// way. Pure: labels come from the vertical config, dates are formatted with
// the tenant locale/timezone passed in.

import type { CrmConfig, CrmStageTone } from "@/config/verticals/_types";
import type { EffectiveLead, ReminderStatus } from "@/lib/crm/effective-stage";

export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) =>
    key in vars ? String(vars[key]) : m,
  );
}

// CLDR renders es-AR day+month WITHOUT a year as "1/9" (ignoring 2-digit), so
// format with the year and drop it — keeps "01/09" and each locale's order.
function formatWithoutYear(date: Date, locale: string, options: Intl.DateTimeFormatOptions): string {
  const parts = new Intl.DateTimeFormat(locale, { ...options, year: "numeric" }).formatToParts(date);
  const y = parts.findIndex((p) => p.type === "year");
  // Remove the year and the separator that joins it to the day/month.
  const drop = new Set([y, parts[y - 1]?.type === "literal" ? y - 1 : y + 1]);
  return parts
    .filter((_, i) => !drop.has(i))
    .map((p) => p.value)
    .join("")
    .trim();
}

export function formatDay(date: Date, locale: string, timezone: string): string {
  return formatWithoutYear(date, locale, { day: "2-digit", month: "2-digit", timeZone: timezone });
}

export function formatDayTime(date: Date, locale: string, timezone: string): string {
  return formatWithoutYear(date, locale, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  });
}

export type LeadView = {
  stageKey: string;
  stageLabel: string;
  tone: CrmStageTone;
  auto: boolean;
  statusText: string | null;
  statusTone: "danger" | "warning" | null;
  ownerEmail: string | null;
  ownerLabel: string;
  reminder: { atIso: string; note: string; status: ReminderStatus; text: string } | null;
  lastActivityText: string;
};

export function buildLeadView(
  lead: EffectiveLead,
  config: CrmConfig,
  ownerLabel: (email: string | null) => string,
  locale: string,
  timezone: string,
): LeadView {
  const labels = config.labels;
  const stageDef = config.stages.find((s) => s.key === lead.stage);

  let statusText: string | null = null;
  let statusTone: LeadView["statusTone"] = null;
  if (lead.lost) {
    const reason =
      lead.lost.reason === "manual"
        ? lead.lost.detail || stageDef?.label || lead.stage
        : labels.lostReasonAuto[lead.lost.reason];
    statusText = fillTemplate(labels.lostSinceTemplate, {
      date: formatDay(lead.lost.at, locale, timezone),
      reason,
    });
    statusTone = "danger";
  } else if (lead.atRisk) {
    statusText = fillTemplate(labels.atRiskTemplate, {
      date: formatDay(lead.atRisk.lostOn, locale, timezone),
    });
    statusTone = "warning";
  }

  let reminder: LeadView["reminder"] = null;
  if (lead.reminder) {
    const when = formatDayTime(lead.reminder.at, locale, timezone);
    reminder = {
      atIso: lead.reminder.at.toISOString(),
      note: lead.reminder.note,
      status: lead.reminder.status,
      text:
        lead.reminder.status === "overdue"
          ? fillTemplate(labels.reminderOverdueTemplate, { date: when })
          : fillTemplate(labels.reminderUpcomingTemplate, { date: when }),
    };
  }

  return {
    stageKey: lead.stage,
    stageLabel: stageDef?.label ?? lead.stage,
    tone: stageDef?.tone ?? "neutral",
    auto: lead.source === "auto",
    statusText,
    statusTone,
    ownerEmail: lead.owner,
    ownerLabel: lead.owner ? ownerLabel(lead.owner) : labels.unassigned,
    reminder,
    lastActivityText: lead.lastActivityAt
      ? formatDayTime(lead.lastActivityAt, locale, timezone)
      : "—",
  };
}

// Display model for a derived lead: stage chip, status line ("pasa a perdido
// el…", "perdido desde…"), owner label and reminder text. Shared by the lead
// card, the /leads table and the board so every surface words a lead the same
// way. Pure: labels come from the vertical config, dates are formatted with
// the tenant locale/timezone passed in.

import type { CrmConfig, CrmStageTone } from "@/config/verticals/_types";
import type { EffectiveLead, ReminderStatus } from "@/lib/crm/effective-stage";
import { priorityView, type PriorityView } from "@/lib/crm/priority";
import type { LeadBudget } from "@/lib/queries/leads";

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

/**
 * Whole calendar days from `now` to `date` in the tenant's timezone. A
 * reminder for tomorrow 09:00 looked at tonight is "mañana" even though it is
 * nine hours away — rounding elapsed hours said "hoy", which is wrong on the
 * card and made the e2e suite flaky late in the UTC day.
 */
export function calendarDaysBetween(date: Date, now: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const utcMidnight = (d: Date) => {
    const parts = fmt.formatToParts(d);
    const num = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    return Date.UTC(num("year"), num("month") - 1, num("day"));
  };
  return Math.round((utcMidnight(date) - utcMidnight(now)) / 86_400_000);
}

/**
 * "hoy" / "ayer" / "hace 3 días" / "hace 2 meses". Used on the board cards,
 * where an exact timestamp is noise; the list keeps the precise date.
 */
export function formatRelative(date: Date, now: Date, locale: string, timezone: string): string {
  const days = calendarDaysBetween(date, now, timezone);
  // Days read better as words ("hoy", "ayer"); months and years don't — "el
  // mes pasado" is vaguer than "hace 1 mes" on a card you scan.
  if (Math.abs(days) < 30) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
  }
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(months, "month");
  return rtf.format(Math.round(months / 12), "year");
}

/** "USD 150.000" — whole units, grouped for the locale. */
export function formatMoney(amount: number, currency: string, locale: string): string {
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount);
  return currency ? `${currency} ${n}` : n;
}

/** A lead's budget as one line: the amount, or the range text the bot captured. */
export function formatBudget(budget: LeadBudget | null, locale: string): string | null {
  if (!budget) return null;
  if (budget.amount !== null) return formatMoney(budget.amount, budget.currency, locale);
  return budget.text || null;
}

/**
 * Board column total: numeric amounts summed PER CURRENCY ("USD 450.000 ·
 * ARS 30.000.000") — never across currencies, and range texts are left out.
 * Null when there is nothing to add.
 */
export function sumBudgets(budgets: ReadonlyArray<LeadBudget | null>, locale: string): string | null {
  const totals = new Map<string, number>();
  for (const b of budgets) {
    if (!b || b.amount === null) continue;
    totals.set(b.currency, (totals.get(b.currency) ?? 0) + b.amount);
  }
  if (totals.size === 0) return null;
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([currency, total]) => formatMoney(total, currency, locale))
    .join(" · ");
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
  reminder: {
    atIso: string;
    note: string;
    status: ReminderStatus;
    text: string;
    // "Vencido hace 2 días" / "Vence mañana" — the callout's headline.
    relativeText: string;
    // "Avisado 09:15" when n8n already pushed it to the owner's WhatsApp;
    // null while it has not gone out. Reading it is how the panel shows that
    // the loop closed without anyone querying the database.
    notifiedText: string | null;
  } | null;
  lastActivityText: string;
  lastActivityRelative: string;
  budgetText: string | null;
  daysInStageText: string | null;
  priority: PriorityView | null;
  // The resolved budget (manual or bot), for controls that need the source.
  budget: LeadBudget | null;
};

export function buildLeadView(
  lead: EffectiveLead,
  config: CrmConfig,
  ownerLabel: (email: string | null) => string,
  locale: string,
  timezone: string,
  now: Date = new Date(),
  budget: LeadBudget | null = null,
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
    const relative = formatRelative(lead.reminder.at, now, locale, timezone);
    reminder = {
      atIso: lead.reminder.at.toISOString(),
      note: lead.reminder.note,
      status: lead.reminder.status,
      text:
        lead.reminder.status === "overdue"
          ? fillTemplate(labels.reminderOverdueTemplate, { date: when })
          : fillTemplate(labels.reminderUpcomingTemplate, { date: when }),
      relativeText:
        lead.reminder.status === "overdue"
          ? fillTemplate(labels.reminderOverdueRelativeTemplate, { relative })
          : fillTemplate(labels.reminderDueRelativeTemplate, { relative }),
      notifiedText: lead.reminder.notifiedAt
        ? fillTemplate(labels.reminderNotifiedTemplate, {
            time: formatDayTime(lead.reminder.notifiedAt, locale, timezone),
          })
        : null,
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
    lastActivityRelative: lead.lastActivityAt
      ? formatRelative(lead.lastActivityAt, now, locale, timezone)
      : "—",
    budgetText: formatBudget(budget, locale),
    daysInStageText: daysInStage(lead.stageSince, now, labels),
    priority: priorityView(lead.priority, labels),
    budget,
  };
}

function daysInStage(since: Date | null, now: Date, labels: CrmConfig["labels"]): string | null {
  if (!since) return null;
  const days = Math.floor((now.getTime() - since.getTime()) / 86_400_000);
  if (days < 0) return null;
  return days === 0 ? labels.daysInStageToday : fillTemplate(labels.daysInStageTemplate, { days });
}

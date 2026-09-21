// The Resumen tab of /leads: four 7-day stats on top, then stages (donut),
// priority, team workload and origin. Pure layout over a LeadsSummary.

import { Activity, CalendarClock, CircleCheckBig, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BreakdownList } from "@/components/dashboard/BreakdownList";
import { StageDonut } from "@/components/dashboard/StageDonut";
import { StatCard } from "@/components/dashboard/StatCard";
import { fillTemplate } from "@/lib/crm/view-model";
import { formatNumber } from "@/lib/format";
import type { LeadsSummary as Summary } from "@/lib/crm/summary";
import type { CrmLabels } from "@/config/verticals/_types";

type Props = {
  summary: Summary;
  labels: CrmLabels;
  locale: string;
  closedHref: string | null;
  dueSoonHref: string;
};

const PRIORITY_BAR: Record<string, string> = {
  danger: "bg-[var(--danger)]",
  warning: "bg-[var(--warning)]",
  neutral: "bg-[var(--muted-ink)]",
  none: "bg-[var(--faint-ink)]",
};

export function LeadsSummary({ summary, labels, locale, closedHref, dueSoonHref }: Props) {
  const t = labels.summary;
  const window = fillTemplate(t.windowTemplate, { days: summary.windowDays });
  const n = (v: number) => formatNumber(v, locale);
  const overdueCaption =
    summary.kpis.overdue === 0
      ? t.noOverdueCaption
      : summary.kpis.overdue === 1
        ? t.overdueCaptionOne
        : fillTemplate(t.overdueCaptionTemplate, { n: summary.kpis.overdue });

  return (
    <section data-testid="leads-summary" className="w-full max-w-[1280px] space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          testId="summary-kpi-closed"
          label={t.closed}
          value={n(summary.kpis.closed)}
          caption={window}
          icon={<CircleCheckBig className="size-4" />}
          href={closedHref ?? undefined}
        />
        <StatCard
          testId="summary-kpi-active"
          label={t.active}
          value={n(summary.kpis.active)}
          caption={window}
          icon={<Activity className="size-4" />}
        />
        <StatCard
          testId="summary-kpi-new"
          label={t.new}
          value={n(summary.kpis.new)}
          caption={window}
          icon={<UserPlus className="size-4" />}
        />
        <StatCard
          testId="summary-kpi-dueSoon"
          label={t.dueSoon}
          value={n(summary.kpis.dueSoon)}
          caption={overdueCaption}
          tone={summary.kpis.overdue > 0 ? "danger" : "neutral"}
          icon={<CalendarClock className="size-4" />}
          href={dueSoonHref}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card data-testid="summary-stages">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[var(--ink)]">{t.stagesTitle}</CardTitle>
            <CardDescription>{t.stagesDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.stages.total === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-[var(--faint-ink)]">{t.empty}</p>
            ) : (
              <StageDonut
                slices={summary.stages.slices}
                total={summary.stages.total}
                totalUnit={t.totalUnit}
                locale={locale}
              />
            )}
          </CardContent>
        </Card>
        <BreakdownList
          testId="summary-priority"
          title={t.priorityTitle}
          description={t.priorityDescription}
          rows={summary.priorities.rows.map((r) => ({ ...r, barClass: PRIORITY_BAR[r.tone] }))}
          locale={locale}
          empty={t.empty}
        />
        <BreakdownList
          testId="summary-workload"
          title={t.workloadTitle}
          description={t.workloadDescription}
          rows={summary.workload.rows}
          locale={locale}
          empty={t.empty}
        />
        <BreakdownList
          testId="summary-sources"
          title={t.sourcesTitle}
          description={t.sourcesDescription}
          rows={summary.sources.rows}
          locale={locale}
          empty={t.empty}
        />
      </div>
    </section>
  );
}

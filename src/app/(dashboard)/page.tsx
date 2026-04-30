import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getFollowUpQueue } from "@/lib/queries/follow-up";
import {
  getBotSelfResolutionRate,
  getIntentCompletionRates,
  getIntentCounts,
  getIntentHandoffRates,
  getIntentHeatmap,
  getIntentMessageCounts,
  getIntentTimeToHandoff,
  getOtrasBreakdown,
} from "@/lib/queries/intents";
import { getDailyMetrics, getWindowKpis } from "@/lib/queries/metrics";
import { tenantConfig } from "@/config/tenant";
import { verticalConfig } from "@/config/verticals";
import { ExportCsvButton } from "@/components/dashboard/ExportCsvButton";
import { FollowUpQueue } from "@/components/dashboard/FollowUpQueue";
import { IntentCompletionStrip } from "@/components/dashboard/IntentCompletionStrip";
import { IntentHeatmap } from "@/components/dashboard/IntentHeatmap";
import { IntentTimeToHandoff } from "@/components/dashboard/IntentTimeToHandoff";
import { IntentTouchToggle } from "@/components/dashboard/IntentTouchToggle";
import { IntentsChart } from "@/components/dashboard/IntentsChart";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { OtrasBreakdown } from "@/components/dashboard/OtrasBreakdown";
import { VolumeChart } from "@/components/dashboard/VolumeChart";
import { formatNumber } from "@/lib/format";

const HEATMAP_WINDOW_DAYS = 28;

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function OverviewPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const heatmapIntentParam = typeof params.heatmapIntent === "string" ? params.heatmapIntent : null;
  const vertical = verticalConfig();
  const heatmapIntent =
    heatmapIntentParam && vertical.intents.some((i) => i.label === heatmapIntentParam)
      ? heatmapIntentParam
      : null;
  const touchParam = typeof params.touch === "string" ? params.touch : null;
  const touch: "first" | "last" | "any" =
    touchParam === "first" || touchParam === "any" ? touchParam : "last";
  const touchSummary =
    touch === "first"
      ? "contactos por primer contacto en 7 días"
      : touch === "any"
        ? "contactos por cualquier intención en 7 días (un contacto puede sumar en varias)"
        : "contactos por último contacto en 7 días";

  const [
    current,
    previous,
    dailyMetrics,
    intentCounts,
    intentCountsPrevious,
    intentMessageCounts,
    intentMessageCountsPrevious,
    intentHandoffRates,
    otrasBreakdown,
    intentHeatmap,
    completionRates,
    selfResolution,
    selfResolutionPrevious,
    timeToHandoff,
    followUp,
  ] = await Promise.all([
    getWindowKpis(6, 0),
    getWindowKpis(13, 7),
    getDailyMetrics(7),
    getIntentCounts(7, 0, touch),
    getIntentCounts(7, 7, touch),
    getIntentMessageCounts(7),
    getIntentMessageCounts(7, 7),
    getIntentHandoffRates(7),
    getOtrasBreakdown(7),
    getIntentHeatmap(HEATMAP_WINDOW_DAYS, heatmapIntent ?? undefined),
    getIntentCompletionRates(7, vertical.intents),
    getBotSelfResolutionRate(7),
    getBotSelfResolutionRate(7, 7),
    getIntentTimeToHandoff(7),
    getFollowUpQueue(5),
  ]);
  const tenant = tenantConfig();

  const leadingIntent = intentCounts[0] ?? null;
  const leadingIntentPrev =
    leadingIntent
      ? intentCountsPrevious.find((row) => row.intent === leadingIntent.intent) ?? null
      : null;

  // Engagement density per bucket: messages ÷ unique contacts. Answers "how
  // chatty is each flow per person?". Tasaciones (multi-step intake) is
  // expected high; Otras (one-shot handoff) is expected ~1.
  const contactsByIntent = new Map(intentCounts.map((row) => [row.intent, row.count]));
  const engagementDensity = intentMessageCounts
    .map((row) => {
      const contacts = contactsByIntent.get(row.intent) ?? 0;
      return {
        intent: row.intent,
        perContact: contacts > 0 ? row.count / contacts : 0,
      };
    })
    .filter((d) => d.perContact > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-[28px] font-semibold leading-tight">Panel</h1>
          <p className="text-sm text-[#6b7280]">
            Últimos 7 días, comparado con los 7 anteriores.
          </p>
        </div>
        <ExportCsvButton
          endpoint="/api/export/daily-metrics"
          label="Exportar métricas"
        />
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {vertical.kpis.map((kpi) => (
          <KpiCard
            key={kpi.id}
            label={kpi.label}
            value={current[kpi.id]}
            previousValue={previous[kpi.id]}
            format={kpi.format}
            higherIsBetter={kpi.higherIsBetter}
            locale={tenant.locale}
          />
        ))}
        {leadingIntent ? (
          <KpiCard
            label="Intención líder"
            value={leadingIntent.count}
            previousValue={leadingIntentPrev?.count ?? 0}
            format="number"
            higherIsBetter={true}
            locale={tenant.locale}
            display={leadingIntent.intent}
            valueCaption={`${formatNumber(leadingIntent.count, tenant.locale)} contactos`}
          />
        ) : null}
        <KpiCard
          label="Resueltas por el bot"
          value={selfResolution.rate}
          previousValue={selfResolutionPrevious.rate}
          format="percent"
          higherIsBetter={true}
          locale={tenant.locale}
          valueCaption={`${formatNumber(selfResolution.contactsSelfResolved, tenant.locale)} de ${formatNumber(selfResolution.contactsTotal, tenant.locale)} contactos`}
        />
      </div>

      <VolumeChart data={dailyMetrics} locale={tenant.locale} />

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <div className="space-y-3">
          <IntentTouchToggle value={touch} />
          <IntentsChart
            data={intentCounts}
            previousData={intentCountsPrevious}
            intents={vertical.intents}
            locale={tenant.locale}
            handoffRates={intentHandoffRates}
            summarySuffix={touchSummary}
          />
          <OtrasBreakdown rows={otrasBreakdown} locale={tenant.locale} />
        </div>
        <IntentsChart
          data={intentMessageCounts}
          previousData={intentMessageCountsPrevious}
          intents={vertical.intents}
          locale={tenant.locale}
          title="Volumen por intención"
          summarySuffix="interacciones en flujos en 7 días"
          tooltipLabel="Interacciones"
          engagementDensity={engagementDensity}
        />
      </div>

      <IntentHeatmap
        data={intentHeatmap}
        intents={vertical.intents}
        selectedIntent={heatmapIntent}
        locale={tenant.locale}
        windowDays={HEATMAP_WINDOW_DAYS}
      />

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <IntentCompletionStrip rows={completionRates} locale={tenant.locale} />
        <IntentTimeToHandoff rows={timeToHandoff} locale={tenant.locale} />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Seguimiento prioritario</h2>
          <Link
            href="/follow-up"
            className="inline-flex items-center gap-1 text-xs text-[#374151] hover:text-[#111827]"
          >
            Ver todos <ArrowRight className="size-3" />
          </Link>
        </div>
        <FollowUpQueue
          rows={followUp}
          locale={tenant.locale}
          timezone={tenant.timezone}
          emptyText="No hay contactos pendientes en este momento."
        />
      </section>
    </div>
  );
}

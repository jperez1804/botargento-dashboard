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
  const activeOption = vertical.attribution.options.find((o) => o.value === touch);
  const optionHelper = activeOption?.helper ?? "";
  const optionLabel = activeOption?.label ?? "";
  const baseTouchSummary = `contactos en 7 días · ${optionHelper.toLowerCase()}`;
  const touchSummary =
    touch === "any"
      ? `${baseTouchSummary} ${vertical.attribution.anyModeWarning.toLowerCase()}`
      : baseTouchSummary;
  const leadingIntentMeta = vertical.attribution.leadingIntentCaptionTemplate.replace(
    "{label}",
    optionLabel,
  );

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
    <div className="space-y-8">
      {/* Editorial masthead — Fraunces h1, mono kicker line above, hairline rule
          below. Carries the "Reserved Operations" gravitas without competing
          with the tenant accent. */}
      <header
        data-reveal
        style={{ ["--reveal-delay" as string]: "0ms" }}
        className="space-y-3 border-b border-[var(--rule)] pb-5"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--muted-ink)] font-[var(--font-geist-mono)]">
            Panel · Últimos 7 días
          </p>
          <ExportCsvButton
            endpoint="/api/export/daily-metrics"
            label="Exportar métricas"
          />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-[var(--font-fraunces)] text-[44px] leading-[1.05] tracking-tight text-[var(--ink)] font-semibold">
            Operaciones del período
          </h1>
          <p className="text-sm text-[var(--muted-ink)]">
            Comparado con los 7 días anteriores.
          </p>
        </div>
      </header>

      {/* Standard KPI strip — 4 volume metrics. Gives a quick read of the
          period without overwhelming the eye. */}
      <div
        data-reveal
        style={{ ["--reveal-delay" as string]: "80ms" }}
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      >
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
      </div>

      {/* Hero KPI row — global self-resolution rate. `Intención líder` used to
          live here, but it depends on `?touch=` so it now lives inside the
          Composición de la demanda section, next to the selector that drives
          its value. */}
      <div
        data-reveal
        style={{ ["--reveal-delay" as string]: "160ms" }}
        className="grid gap-4 grid-cols-1 lg:grid-cols-2"
      >
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

      {/* Daily volume — full-width, kicker caption above. */}
      <section
        data-reveal
        style={{ ["--reveal-delay" as string]: "240ms" }}
        className="space-y-2"
      >
        <SectionHeading kicker="Volumen diario">Mensajes entrantes y salientes</SectionHeading>
        <VolumeChart data={dailyMetrics} locale={tenant.locale} />
      </section>

      {/* Intenciones block. Touch-attribution toggle moves into the section
          header line so the page reads like a story, not a control panel. */}
      <section
        data-reveal
        style={{ ["--reveal-delay" as string]: "320ms" }}
        className="space-y-3"
      >
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-dotted border-[var(--rule)] pb-2">
          <SectionHeading kicker="Intenciones">Composición de la demanda</SectionHeading>
          <IntentTouchToggle value={touch} attribution={vertical.attribution} />
        </div>
        {leadingIntent ? (
          <KpiCard
            label="Intención líder"
            value={leadingIntent.count}
            previousValue={leadingIntentPrev?.count ?? 0}
            format="number"
            higherIsBetter={true}
            locale={tenant.locale}
            display={leadingIntent.intent}
            valueCaption={`${formatNumber(leadingIntent.count, tenant.locale)} contactos en 7 días`}
            meta={leadingIntentMeta}
          />
        ) : null}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <div className="space-y-3">
            <IntentsChart
              data={intentCounts}
              previousData={intentCountsPrevious}
              intents={vertical.intents}
              locale={tenant.locale}
              handoffRates={intentHandoffRates}
              summarySuffix={touchSummary}
              handoffDisclaimerShort={vertical.attribution.handoffDisclaimerShort}
              handoffDisclaimerDetail={vertical.attribution.handoffDisclaimerDetail}
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
            engagementDensityNote={vertical.attribution.engagementDensityNote}
          />
        </div>
        <IntentHeatmap
          data={intentHeatmap}
          intents={vertical.intents}
          selectedIntent={heatmapIntent}
          locale={tenant.locale}
          windowDays={HEATMAP_WINDOW_DAYS}
        />
      </section>

      {/* Operativo block — completion + time-to-handoff. */}
      <section
        data-reveal
        style={{ ["--reveal-delay" as string]: "400ms" }}
        className="space-y-3"
      >
        <SectionHeading kicker="Operativo">Eficiencia de los flujos</SectionHeading>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <IntentCompletionStrip rows={completionRates} locale={tenant.locale} />
          <IntentTimeToHandoff rows={timeToHandoff} locale={tenant.locale} />
        </div>
      </section>

      {/* Seguimiento — top-5 follow-up preview, link to full queue. */}
      <section
        data-reveal
        style={{ ["--reveal-delay" as string]: "480ms" }}
        className="space-y-3"
      >
        <div className="flex items-end justify-between gap-3">
          <SectionHeading kicker="Seguimiento">Contactos prioritarios</SectionHeading>
          <Link
            href="/follow-up"
            className="inline-flex items-center gap-1 text-xs text-[var(--muted-ink)] hover:text-[var(--client-primary)] transition-colors"
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

// Section heading: mono kicker label up top + Fraunces title below. Used as
// the header for each block on the overview to keep the editorial rhythm
// consistent without re-implementing the markup five times.
function SectionHeading({
  kicker,
  children,
}: {
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--muted-ink)] font-[var(--font-geist-mono)]">
        {kicker}
      </p>
      <h2 className="font-[var(--font-fraunces)] text-[22px] leading-tight tracking-tight text-[var(--ink)] font-medium">
        {children}
      </h2>
    </div>
  );
}

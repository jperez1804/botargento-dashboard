import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getFollowUpQueue } from "@/lib/queries/follow-up";
import { getIntentCounts } from "@/lib/queries/intents";
import { getDailyMetrics, getWindowKpis } from "@/lib/queries/metrics";
import { tenantConfig } from "@/config/tenant";
import { verticalConfig } from "@/config/verticals";
import { ExportCsvButton } from "@/components/dashboard/ExportCsvButton";
import { FollowUpQueue } from "@/components/dashboard/FollowUpQueue";
import { IntentsChart } from "@/components/dashboard/IntentsChart";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { VolumeChart } from "@/components/dashboard/VolumeChart";

export default async function OverviewPage() {
  const [current, previous, dailyMetrics, intentCounts, followUp] = await Promise.all([
    getWindowKpis(6, 0),
    getWindowKpis(13, 7),
    getDailyMetrics(7),
    getIntentCounts(7),
    getFollowUpQueue(5),
  ]);
  const tenant = tenantConfig();
  const vertical = verticalConfig();

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

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <VolumeChart data={dailyMetrics} locale={tenant.locale} />
        <IntentsChart data={intentCounts} intents={vertical.intents} locale={tenant.locale} />
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

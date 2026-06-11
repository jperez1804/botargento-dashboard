import { notFound } from "next/navigation";
import { verticalConfig } from "@/config/verticals";
import { tenantConfig } from "@/config/tenant";
import {
  getOutreachOverview,
  getQualityCurrent,
  selectCampaignDaily,
  selectCampaignStats,
} from "@/db/views";
import { QualityBadge } from "@/components/dashboard/QualityBadge";
import { CampaignsTable } from "@/components/dashboard/CampaignsTable";
import { CampaignsDailyChart } from "@/components/dashboard/CampaignsDailyChart";
import { formatNumber, formatPercent } from "@/lib/format";

const DAILY_WINDOW = 28;

export default async function CampaignsPage() {
  if (!verticalConfig().features?.campaignsTab) {
    notFound();
  }

  const tenant = tenantConfig();
  const [overview, campaigns, daily, quality] = await Promise.all([
    getOutreachOverview(),
    selectCampaignStats(),
    selectCampaignDaily(DAILY_WINDOW),
    getQualityCurrent(),
  ]);

  // Sum the per-campaign daily rows into one series for the chart.
  const byDay = new Map<string, number>();
  for (const d of daily) byDay.set(d.day, (byDay.get(d.day) ?? 0) + d.sent_count);
  const chartData = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, sent]) => ({ day, sent }));

  const tiles = [
    { label: "Prospectos", value: formatNumber(overview.total_recipients, tenant.locale) },
    { label: "Enviados", value: formatNumber(overview.total_sent, tenant.locale) },
    { label: "Tasa de respuesta", value: formatPercent(overview.reply_rate, tenant.locale) },
    { label: "Respondieron", value: formatNumber(overview.total_replied, tenant.locale) },
    { label: "Bajas", value: formatNumber(overview.total_opted_out, tenant.locale) },
    { label: "Suprimidos", value: formatNumber(overview.suppressed, tenant.locale) },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-3 border-b border-[var(--rule)] pb-5">
        <p className="font-[var(--font-geist-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)]">
          Outbound
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-[var(--ink)]">
            Campañas
          </h1>
          <p className="text-[13px] text-[var(--muted-ink)]">
            Enviados hoy: {formatNumber(overview.sent_today, tenant.locale)}
          </p>
        </div>
      </header>

      <QualityBadge
        rating={quality.quality_rating}
        tier={quality.messaging_limit_tier}
        lastUpdated={quality.last_updated}
        locale={tenant.locale}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-md border border-[var(--rule)] border-t-2 border-t-[var(--client-primary)] bg-[var(--surface)] px-4 py-3"
          >
            <p className="font-[var(--font-geist-mono)] text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--soft-ink)]">
              {t.label}
            </p>
            <p className="mt-1 font-[var(--font-fraunces)] text-[26px] font-semibold tabular-nums text-[var(--ink)]">
              {t.value}
            </p>
          </div>
        ))}
      </section>

      <CampaignsTable rows={campaigns} locale={tenant.locale} />

      <CampaignsDailyChart data={chartData} locale={tenant.locale} />
    </div>
  );
}

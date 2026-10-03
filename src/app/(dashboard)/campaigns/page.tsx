import Link from "next/link";
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
import { CampaignsPoller } from "@/components/dashboard/CampaignRowActions";
import { campaignActionsEnabled } from "@/lib/campaigns";
import { formatNumber, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DAILY_WINDOW = 28;

// Same chips as Conversaciones › "Sin derivar": URL state, so the filter
// survives the poller's refresh and a shared link.
const CHIP =
  "inline-flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors duration-150";
const CHIP_ON =
  "border-[color-mix(in_oklch,var(--client-primary)_55%,var(--rule))] bg-[color-mix(in_oklch,var(--client-primary)_12%,var(--surface))] text-[var(--ink)]";
const CHIP_OFF =
  "border-[var(--rule)] bg-[var(--canvas-2)] text-[var(--muted-ink)] hover:border-[var(--rule-strong)] hover:text-[var(--ink)]";

type SearchParams = Promise<{ status?: string }>;

export default async function CampaignsPage({ searchParams }: { searchParams: SearchParams }) {
  if (!verticalConfig().features?.campaignsTab) {
    notFound();
  }

  const sp = await searchParams;
  const activeOnly = sp.status === "active";
  const tenant = tenantConfig();
  const [overview, campaigns, daily, quality] = await Promise.all([
    getOutreachOverview(),
    selectCampaignStats(),
    selectCampaignDaily(DAILY_WINDOW),
    getQualityCurrent(),
  ]);

  const activeCount = campaigns.filter((c) => c.status === "active").length;
  const shown = activeOnly ? campaigns.filter((c) => c.status === "active") : campaigns;

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
    <div data-board-bleed className="space-y-6">
      <CampaignsPoller />
      <PageHeader
        kicker="Outbound"
        title="Campañas"
        meta={`Enviados hoy: ${formatNumber(overview.sent_today, tenant.locale)}`}
      />

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

      <div className="flex flex-wrap gap-2" data-testid="campaigns-filter">
        <Link href="/campaigns" data-testid="campaigns-all" className={cn(CHIP, activeOnly ? CHIP_OFF : CHIP_ON)}>
          Todas · {formatNumber(campaigns.length, tenant.locale)}
        </Link>
        <Link
          href="/campaigns?status=active"
          data-testid="campaigns-active"
          className={cn(CHIP, activeOnly ? CHIP_ON : CHIP_OFF)}
        >
          Activas · {formatNumber(activeCount, tenant.locale)}
        </Link>
      </div>

      <CampaignsTable
        rows={shown}
        locale={tenant.locale}
        actionsEnabled={campaignActionsEnabled()}
      />

      <CampaignsDailyChart data={chartData} locale={tenant.locale} />
    </div>
  );
}

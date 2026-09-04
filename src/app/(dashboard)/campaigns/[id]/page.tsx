// Campaign detail — read-only per-campaign funnel + daily series + latest
// recipients, with the same row actions as the list when the tenant has the
// campaign-actions webhook configured. Gated like /campaigns.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { verticalConfig } from "@/config/verticals";
import { tenantConfig } from "@/config/tenant";
import {
  selectCampaignDaily,
  selectCampaignRecipients,
  selectCampaignStats,
} from "@/db/views";
import {
  CampaignProgressBar,
  campaignProgress,
  CampaignsTable,
} from "@/components/dashboard/CampaignsTable";
import {
  CampaignRowActions,
  CampaignsPoller,
} from "@/components/dashboard/CampaignRowActions";
import { CampaignsDailyChart } from "@/components/dashboard/CampaignsDailyChart";
import { campaignActionsEnabled } from "@/lib/campaigns";
import { formatNumber, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

const DAILY_WINDOW = 28;

const RECIPIENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  replied: "Respondió",
  failed: "Falló",
  opted_out: "Baja",
  later: "Más adelante",
};

type Props = { params: Promise<{ id: string }> };

export default async function CampaignDetailPage({ params }: Props) {
  if (!verticalConfig().features?.campaignsTab) notFound();

  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isInteger(campaignId) || campaignId <= 0) notFound();

  const tenant = tenantConfig();
  const [allStats, daily, recipients] = await Promise.all([
    selectCampaignStats(),
    selectCampaignDaily(DAILY_WINDOW),
    selectCampaignRecipients(campaignId),
  ]);

  const c = allStats.find((r) => r.campaign_id === campaignId);
  if (!c) notFound();

  const chartData = daily
    .filter((d) => d.campaign_id === campaignId)
    .sort((a, b) => (a.day < b.day ? -1 : 1))
    .map((d) => ({ day: d.day, sent: d.sent_count }));

  const actionsEnabled = campaignActionsEnabled();

  const dateFmt = new Intl.DateTimeFormat(tenant.locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tenant.timezone,
  });

  const tiles = [
    { label: "Prospectos", value: formatNumber(c.total_recipients, tenant.locale) },
    { label: "Pendientes", value: formatNumber(c.pending, tenant.locale) },
    { label: "Respondieron", value: formatNumber(c.replied, tenant.locale) },
    { label: "Tasa de respuesta", value: formatPercent(c.reply_rate, tenant.locale) },
    { label: "Bajas", value: formatNumber(c.opted_out, tenant.locale) },
    { label: "Hoy / Cap", value: `${formatNumber(c.sent_today, tenant.locale)} / ${formatNumber(c.daily_cap, tenant.locale)}` },
  ];

  return (
    <div className="space-y-6">
      <CampaignsPoller />
      <header className="space-y-3 border-b border-[var(--rule)] pb-5">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1 font-[var(--font-geist-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)] hover:text-[var(--ink)]"
        >
          <ArrowLeft className="size-3" aria-hidden />
          Campañas
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-[var(--ink)]">
              {c.name}
            </h1>
            <p className="font-[var(--font-geist-mono)] text-[12px] text-[var(--soft-ink)]">
              {c.template_name} · {c.vertical}
            </p>
          </div>
          {actionsEnabled ? (
            <CampaignRowActions
              campaignId={c.campaign_id}
              status={c.status}
              pending={c.pending}
            />
          ) : null}
        </div>
        <CampaignProgressBar
          value={campaignProgress(c)}
          locale={tenant.locale}
          className="max-w-md"
        />
      </header>

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

      <CampaignsTable rows={[c]} locale={tenant.locale} actionsEnabled={actionsEnabled} />

      <CampaignsDailyChart data={chartData} locale={tenant.locale} />

      <section className="space-y-2">
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">Últimos contactados</h2>
        {recipients.length === 0 ? (
          <div className="rounded-md border border-[var(--rule)] bg-[var(--surface)] px-4 py-6 text-center text-[13px] text-[var(--muted-ink)]">
            Todavía no se contactó a nadie.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-[var(--rule)]">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--rule)] bg-[var(--canvas)] text-left">
                  {["Negocio", "Número", "Estado", "Último envío"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 font-[var(--font-geist-mono)] text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--soft-ink)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.wa_id} className="border-b border-[var(--rule)] last:border-0">
                    <td className="px-3 py-2 text-[var(--ink)]">
                      {r.business_name || r.contact_name || "—"}
                    </td>
                    <td className="px-3 py-2 font-[var(--font-geist-mono)] tabular-nums text-[var(--muted-ink)]">
                      {r.wa_id}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted-ink)]">
                      {RECIPIENT_STATUS_LABEL[r.status] ?? r.status}
                    </td>
                    <td className="px-3 py-2 font-[var(--font-geist-mono)] tabular-nums text-[var(--soft-ink)]">
                      {r.last_send_at ? dateFmt.format(new Date(r.last_send_at)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

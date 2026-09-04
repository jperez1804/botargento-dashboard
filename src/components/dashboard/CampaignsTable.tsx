import Link from "next/link";
import type { CampaignStatsRow } from "@/db/views";
import { formatNumber, formatPercent } from "@/lib/format";
import {
  CampaignCapEditor,
  CampaignRowActions,
} from "@/components/dashboard/CampaignRowActions";

// Domain-semantic status palette (not brand).
const STATUS_PALETTE: Record<string, { bg: string; fg: string; label: string }> = {
  active: { bg: "#E6F4EA", fg: "#1B5E20", label: "Activa" },
  paused: { bg: "#FCE5CD", fg: "#8A4B00", label: "Pausada" },
  draft: { bg: "#F1F1F1", fg: "#555555", label: "Borrador" },
  done: { bg: "#EAEAEA", fg: "#333333", label: "Finalizada" },
};

// Share of the pool already sent (every non-pending row was attempted).
export const campaignProgress = (r: CampaignStatsRow): number =>
  r.total_recipients > 0 ? (r.total_recipients - r.pending) / r.total_recipients : 0;

export function CampaignProgressBar({
  value,
  locale,
  className = "",
}: {
  value: number;
  locale: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso de envío"
        className="h-1.5 w-full min-w-16 max-w-28 overflow-hidden rounded-full bg-[var(--canvas-2)]"
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${pct * 100}%`,
            backgroundColor: pct >= 1 ? "#1B5E20" : "var(--client-primary)",
          }}
        />
      </div>
      <span className="font-[var(--font-geist-mono)] text-[11px] tabular-nums text-[var(--muted-ink)]">
        {formatPercent(pct, locale, 0)}
      </span>
    </div>
  );
}

type Props = {
  rows: CampaignStatsRow[];
  locale: string;
  actionsEnabled?: boolean;
};

export function CampaignsTable({ rows, locale, actionsEnabled = false }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-[var(--rule)] bg-[var(--surface)] px-4 py-8 text-center text-[13px] text-[var(--muted-ink)]">
        No hay campañas todavía.
      </div>
    );
  }

  const headers = [
    "Campaña",
    "Estado",
    "Progreso",
    "Prospectos",
    "Enviados",
    "Respondió",
    "Bajas",
    "Resp. %",
    "Hoy / Cap",
    ...(actionsEnabled ? ["Acciones"] : []),
  ];

  return (
    <div className="overflow-x-auto rounded-md border border-[var(--rule)]">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[var(--rule)] bg-[var(--canvas)] text-left">
            {headers.map((h) => (
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
          {rows.map((r) => {
            const st = STATUS_PALETTE[r.status] ?? {
              bg: "#F1F1F1",
              fg: "#555555",
              label: r.status,
            };
            const overCap = r.sent_today >= r.daily_cap;
            return (
              <tr key={r.campaign_id} className="border-b border-[var(--rule)] last:border-0">
                <td className="px-3 py-2.5">
                  <Link
                    href={`/campaigns/${r.campaign_id}`}
                    className="font-medium text-[var(--ink)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)]"
                  >
                    {r.name}
                  </Link>
                  <div className="font-[var(--font-geist-mono)] text-[11px] text-[var(--soft-ink)]">
                    {r.template_name}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ backgroundColor: st.bg, color: st.fg }}
                  >
                    {st.label}
                  </span>
                  {r.status === "active" && r.pending === 0 ? (
                    <div
                      className="mt-1 font-[var(--font-geist-mono)] text-[10px] uppercase tracking-[0.06em] text-[var(--soft-ink)]"
                      title="No quedan pendientes; se puede finalizar o sumar prospectos"
                    >
                      Pool completo
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2.5">
                  <CampaignProgressBar value={campaignProgress(r)} locale={locale} />
                </td>
                <td className="px-3 py-2.5 font-[var(--font-geist-mono)] tabular-nums text-[var(--ink)]">
                  {formatNumber(r.total_recipients, locale)}
                </td>
                <td className="px-3 py-2.5 font-[var(--font-geist-mono)] tabular-nums text-[var(--muted-ink)]">
                  {formatNumber(r.sent, locale)}
                </td>
                <td className="px-3 py-2.5 font-[var(--font-geist-mono)] tabular-nums text-[var(--ink)]">
                  {formatNumber(r.replied, locale)}
                </td>
                <td className="px-3 py-2.5 font-[var(--font-geist-mono)] tabular-nums text-[var(--muted-ink)]">
                  {formatNumber(r.opted_out, locale)}
                </td>
                <td className="px-3 py-2.5 font-[var(--font-geist-mono)] tabular-nums text-[var(--ink)]">
                  {formatPercent(r.reply_rate, locale)}
                </td>
                <td className="px-3 py-2.5 font-[var(--font-geist-mono)] tabular-nums">
                  <span style={{ color: overCap ? "#8A4B00" : "var(--muted-ink)" }}>
                    {formatNumber(r.sent_today, locale)} /{" "}
                    {actionsEnabled ? (
                      <CampaignCapEditor campaignId={r.campaign_id} dailyCap={r.daily_cap} />
                    ) : (
                      formatNumber(r.daily_cap, locale)
                    )}
                  </span>
                </td>
                {actionsEnabled ? (
                  <td className="px-3 py-2.5">
                    <CampaignRowActions
                      campaignId={r.campaign_id}
                      status={r.status}
                      pending={r.pending}
                    />
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

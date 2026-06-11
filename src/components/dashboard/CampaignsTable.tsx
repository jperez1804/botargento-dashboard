import type { CampaignStatsRow } from "@/db/views";
import { formatNumber, formatPercent } from "@/lib/format";

// Domain-semantic status palette (not brand).
const STATUS_PALETTE: Record<string, { bg: string; fg: string; label: string }> = {
  active: { bg: "#E6F4EA", fg: "#1B5E20", label: "Activa" },
  paused: { bg: "#FCE5CD", fg: "#8A4B00", label: "Pausada" },
  draft: { bg: "#F1F1F1", fg: "#555555", label: "Borrador" },
  done: { bg: "#EAEAEA", fg: "#333333", label: "Finalizada" },
};

type Props = {
  rows: CampaignStatsRow[];
  locale: string;
};

export function CampaignsTable({ rows, locale }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-[var(--rule)] bg-[var(--surface)] px-4 py-8 text-center text-[13px] text-[var(--muted-ink)]">
        No hay campañas todavía.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-[var(--rule)]">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[var(--rule)] bg-[var(--canvas)] text-left">
            {["Campaña", "Estado", "Prospectos", "Enviados", "Respondió", "Bajas", "Resp. %", "Hoy / Cap"].map(
              (h) => (
                <th
                  key={h}
                  className="px-3 py-2 font-[var(--font-geist-mono)] text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--soft-ink)]"
                >
                  {h}
                </th>
              ),
            )}
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
                  <div className="font-medium text-[var(--ink)]">{r.name}</div>
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
                    {formatNumber(r.sent_today, locale)} / {formatNumber(r.daily_cap, locale)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

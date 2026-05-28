import {
  countBusinessHandoffs,
  getHandoffSummary,
  listBusinessHandoffs,
} from "@/lib/queries/handoffs";
import { tenantConfig } from "@/config/tenant";
import { verticalConfig } from "@/config/verticals";
import { HandoffSummaryCards } from "@/components/dashboard/HandoffSummaryCards";
import { HandoffsTable } from "@/components/dashboard/HandoffsTable";
import { formatNumber } from "@/lib/format";

export default async function HandoffsPage() {
  const [summary, rows, total] = await Promise.all([
    getHandoffSummary(),
    listBusinessHandoffs({ limit: 200 }),
    countBusinessHandoffs(),
  ]);
  const tenant = tenantConfig();
  const vertical = verticalConfig();

  return (
    <div className="space-y-6">
      {/* Page header — sans Display weight, mono kicker, hairline rule below.
       * Mirrors the masthead pattern on the overview page. */}
      <header className="space-y-3 border-b border-[var(--rule)] pb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)] font-[var(--font-geist-mono)]">
          Operación
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-[30px] leading-[1.1] tracking-[-0.025em] text-[var(--ink)] font-semibold">
            Derivaciones
          </h1>
          <p className="text-[13px] text-[var(--muted-ink)]">
            Pedidos de contacto con el equipo humano · {formatNumber(total, tenant.locale)} en total
          </p>
        </div>
      </header>

      <section className="space-y-2.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)]">
          Pedidos por destino · últimas 24h
        </p>
        <HandoffSummaryCards
          rows={summary}
          targets={vertical.handoffTargets}
          locale={tenant.locale}
        />
      </section>

      <section className="space-y-2.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)]">
          Cola de derivaciones
        </p>
        <HandoffsTable
          data={rows}
          targets={vertical.handoffTargets}
          locale={tenant.locale}
          timezone={tenant.timezone}
        />
      </section>
    </div>
  );
}

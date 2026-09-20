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
import { PageHeader } from "@/components/layout/PageHeader";

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
      <PageHeader
        kicker="Operación"
        title="Derivaciones"
        meta={`Pedidos de contacto con el equipo humano · ${formatNumber(total, tenant.locale)} en total`}
      />

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

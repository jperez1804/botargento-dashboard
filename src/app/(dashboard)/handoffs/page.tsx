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
      <div className="space-y-1">
        <h1 className="text-[28px] font-semibold leading-tight">Derivaciones</h1>
        <p className="text-sm text-[#6b7280]">
          Pedidos de contacto con el equipo humano.{" "}
          {formatNumber(total, tenant.locale)} en total.
        </p>
      </div>

      <HandoffSummaryCards
        rows={summary}
        targets={vertical.handoffTargets}
        locale={tenant.locale}
      />

      <HandoffsTable
        data={rows}
        targets={vertical.handoffTargets}
        locale={tenant.locale}
        timezone={tenant.timezone}
      />
    </div>
  );
}

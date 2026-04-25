import Link from "next/link";
import { getFollowUpQueue } from "@/lib/queries/follow-up";
import { tenantConfig } from "@/config/tenant";
import { formatNumber } from "@/lib/format";
import { FollowUpQueue } from "@/components/dashboard/FollowUpQueue";

export default async function FollowUpPage() {
  const rows = await getFollowUpQueue();
  const tenant = tenantConfig();

  const high = rows.filter((r) => r.priority === "high").length;
  const medium = rows.filter((r) => r.priority === "medium").length;
  const low = rows.filter((r) => r.priority === "low").length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-[28px] font-semibold leading-tight">Seguimiento</h1>
        <p className="text-sm text-[#6b7280]">
          {formatNumber(rows.length, tenant.locale)} contactos pendientes ·{" "}
          <span className="text-[#8A1A1A]">{formatNumber(high, tenant.locale)} alta</span> ·{" "}
          <span className="text-[#8A4B00]">{formatNumber(medium, tenant.locale)} media</span> ·{" "}
          <span className="text-[#1B5E20]">{formatNumber(low, tenant.locale)} baja</span>
        </p>
      </div>

      <FollowUpQueue rows={rows} locale={tenant.locale} timezone={tenant.timezone} />

      <p className="text-xs text-[#9ca3af]">
        Las prioridades se calculan en{" "}
        <Link href="/" className="underline-offset-4 hover:underline">
          el panel
        </Link>{" "}
        a partir de la última intención y la fecha del último contacto.
      </p>
    </div>
  );
}

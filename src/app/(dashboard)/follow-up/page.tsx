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
      <header className="space-y-3 border-b border-[var(--rule)] pb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)] font-[var(--font-geist-mono)]">
          Operación
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-[30px] leading-[1.1] tracking-[-0.025em] text-[var(--ink)] font-semibold">
            Seguimiento
          </h1>
          {/* Tier summary chips — same tone semantics as the priority pills
            * in the queue below. Inline since this row IS the page subtitle
            * and the only counts that matter on this page. */}
          <div className="flex flex-wrap items-center gap-3 text-[12.5px]">
            <span className="text-[var(--muted-ink)]">
              {formatNumber(rows.length, tenant.locale)} contactos pendientes
            </span>
            <TierTag tone="danger" count={high} label="alta" locale={tenant.locale} />
            <TierTag tone="warning" count={medium} label="media" locale={tenant.locale} />
            <TierTag tone="positive" count={low} label="baja" locale={tenant.locale} />
          </div>
        </div>
      </header>

      <FollowUpQueue rows={rows} locale={tenant.locale} timezone={tenant.timezone} />

      <p className="text-[12px] text-[var(--soft-ink)]">
        Las prioridades se calculan en{" "}
        <Link
          href="/"
          className="text-[var(--muted-ink)] underline underline-offset-[3px] hover:text-[var(--ink)]"
        >
          el panel
        </Link>{" "}
        a partir de la última intención y la fecha del último contacto.
      </p>
    </div>
  );
}

function TierTag({
  tone,
  count,
  label,
  locale,
}: {
  tone: "danger" | "warning" | "positive";
  count: number;
  label: string;
  locale: string;
}) {
  const TONE = {
    danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
    warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
    positive: "bg-[var(--positive-soft)] text-[var(--positive)]",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[11.5px] font-medium tabular-nums ${TONE}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {formatNumber(count, locale)} {label}
    </span>
  );
}

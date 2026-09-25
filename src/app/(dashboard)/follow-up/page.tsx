import Link from "next/link";
import { getFollowUpQueue } from "@/lib/queries/follow-up";
import { tenantConfig } from "@/config/tenant";
import { formatNumber } from "@/lib/format";
import { FollowUpQueue } from "@/components/dashboard/FollowUpQueue";
import { PageHeader } from "@/components/layout/PageHeader";
import { RemindersList, type ReminderRow } from "@/components/dashboard/RemindersList";
import { crmConfig } from "@/lib/crm/enabled";
import { buildLeadView } from "@/lib/crm/view-model";
import { getSessionRole } from "@/lib/role-guard";
import { listLeads } from "@/lib/queries/leads";
import { listTeam, memberLabel } from "@/lib/queries/team";

export default async function FollowUpPage() {
  const crm = crmConfig();
  const tenant = tenantConfig();
  const [rows, reminders] = await Promise.all([getFollowUpQueue(), loadReminders(crm, tenant)]);

  const high = rows.filter((r) => r.priority === "high").length;
  const medium = rows.filter((r) => r.priority === "medium").length;
  const low = rows.filter((r) => r.priority === "low").length;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Operación"
        title="Seguimiento"
        meta={
          /* Tier summary chips — same tone semantics as the priority pills in
           * the queue below. They ARE this page's subtitle. */
          <div className="flex flex-wrap items-center gap-3 text-[12.5px]">
            <span>{formatNumber(rows.length, tenant.locale)} contactos pendientes</span>
            <TierTag tone="danger" count={high} label="alta" locale={tenant.locale} />
            <TierTag tone="warning" count={medium} label="media" locale={tenant.locale} />
            <TierTag tone="positive" count={low} label="baja" locale={tenant.locale} />
          </div>
        }
      />

      {crm ? (
        <RemindersList rows={reminders} labels={crm.labels} title={crm.labels.remindersTitle} />
      ) : null}

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

/**
 * Open reminders that need attention now: overdue, or due inside the warning
 * window. An admin sees the whole team's; an asesor sees their own plus the
 * ones nobody owns — those are theirs to pick up (regla 16), and they are also
 * the ones no WhatsApp notice can reach, so hiding them would let a reminder
 * die in silence.
 */
async function loadReminders(
  crm: ReturnType<typeof crmConfig>,
  tenant: ReturnType<typeof tenantConfig>,
): Promise<ReminderRow[]> {
  if (!crm) return [];
  const session = await getSessionRole();
  if (!session) return [];
  const [result, team] = await Promise.all([
    // No owner filter: it would drop the unassigned ones (listLeads keeps only
    // exact owner matches), so the scoping happens below.
    listLeads(crm, { includeLost: true }, new Date()),
    listTeam(),
  ]);
  const mine = (owner: string | null) =>
    session.role === "admin" || owner === null || owner === session.email;
  const labelFor = (email: string | null) => memberLabel(team, email);
  return result.rows
    .filter((r) => r.lead.reminder?.status === "overdue" || r.lead.reminder?.status === "upcoming")
    .filter((r) => mine(r.lead.owner))
    .sort((a, b) => (a.lead.reminder?.at.getTime() ?? 0) - (b.lead.reminder?.at.getTime() ?? 0))
    .map((r) => ({
      id: r.id,
      waId: r.contactWaId,
      displayName: r.displayName,
      view: buildLeadView(r.lead, crm, labelFor, tenant.locale, tenant.timezone),
    }));
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

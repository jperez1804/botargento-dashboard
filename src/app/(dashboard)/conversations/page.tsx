import Link from "next/link";
import { countContacts, listContacts } from "@/lib/queries/contacts";
import { countUnderived, listUnderivedConversations } from "@/lib/queries/underived";
import { crmConfig } from "@/lib/crm/enabled";
import { getSessionRole, hasRole } from "@/lib/role-guard";
import { UnderivedTable } from "@/components/dashboard/UnderivedTable";
import { underivedCount } from "@/components/dashboard/UnderivedNotice";
import { cn } from "@/lib/utils";
import { tenantConfig } from "@/config/tenant";
import { verticalConfig } from "@/config/verticals";
import { ContactsFilters } from "@/components/dashboard/ContactsFilters";
import { ExportCsvButton } from "@/components/dashboard/ExportCsvButton";
import { TopContactsTable } from "@/components/dashboard/TopContactsTable";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { crmKinds } from "@/lib/crm/intent";

const PAGE_SIZE = 25;

type Props = {
  searchParams: Promise<{
    q?: string;
    from?: string;
    to?: string;
    page?: string;
    // no_handoff = wrote to the bot, never got handed over, so no opportunity.
    filter?: string;
  }>;
};

const CHIP =
  "inline-flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors duration-150";
const CHIP_ON =
  "border-[color-mix(in_oklch,var(--client-primary)_55%,var(--rule))] bg-[color-mix(in_oklch,var(--client-primary)_12%,var(--surface))] text-[var(--ink)]";
const CHIP_OFF =
  "border-[var(--rule)] bg-[var(--canvas-2)] text-[var(--muted-ink)] hover:border-[var(--rule-strong)] hover:text-[var(--ink)]";

export default async function ConversationsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const search = sp.q?.trim() || undefined;
  const from = sp.from || undefined;
  const to = sp.to || undefined;
  const pageNum = Math.max(1, Number(sp.page) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;
  const crm = crmConfig();
  const underivedView = Boolean(crm) && sp.filter === "no_handoff";

  const [rows, total, session, underived, underivedTotal] = await Promise.all([
    underivedView ? Promise.resolve([]) : listContacts({ search, from, to, limit: PAGE_SIZE, offset }),
    underivedView ? Promise.resolve(0) : countContacts({ search, from, to }),
    crm ? getSessionRole() : Promise.resolve(null),
    underivedView && crm
      ? listUnderivedConversations(crm, { limit: PAGE_SIZE, offset })
      : Promise.resolve([]),
    crm ? countUnderived(crm) : Promise.resolve(0),
  ]);
  const tenant = tenantConfig();
  const vertical = verticalConfig();
  const canEdit = session ? hasRole(session, "asesor") : false;

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/conversations${qs ? `?${qs}` : ""}`;
  };
  const buildUnderivedPageHref = (page: number) =>
    `/conversations?filter=no_handoff${page > 1 ? `&page=${page}` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Operación"
        title="Conversaciones"
        meta={
          underivedView
            ? crm?.labels.opportunity.underivedHint
            : `Listado ordenado por última actividad · ${formatNumber(total, tenant.locale)} en total`
        }
        actions={
          <ExportCsvButton endpoint="/api/export/conversations" params={{ from, to, search }} />
        }
      />

      {/* Not every conversation becomes an opportunity: only a handoff opens
          one. These are the ones that stopped short. */}
      {crm && underivedTotal > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/conversations"
            data-testid="conversations-all"
            className={cn(CHIP, underivedView ? CHIP_OFF : CHIP_ON)}
          >
            {crm.labels.opportunity.allConversations}
          </Link>
          <Link
            href="/conversations?filter=no_handoff"
            data-testid="conversations-no-handoff"
            className={cn(CHIP, underivedView ? CHIP_ON : CHIP_OFF)}
          >
            {underivedCount(crm.labels, underivedTotal)}
          </Link>
        </div>
      ) : null}

      {underivedView && crm ? (
        <UnderivedTable
          rows={underived}
          config={crm}
          intents={crmKinds(crm)}
          locale={tenant.locale}
          timezone={tenant.timezone}
          canEdit={canEdit}
          page={pageNum}
          pageSize={PAGE_SIZE}
          total={underivedTotal}
          buildPageHref={buildUnderivedPageHref}
        />
      ) : (
        <>
          <ContactsFilters />

          <TopContactsTable
            rows={rows}
            intents={vertical.intents}
            locale={tenant.locale}
            timezone={tenant.timezone}
            page={pageNum}
            pageSize={PAGE_SIZE}
            total={total}
            buildPageHref={buildPageHref}
          />
        </>
      )}
    </div>
  );
}

import { countContacts, listContacts } from "@/lib/queries/contacts";
import { tenantConfig } from "@/config/tenant";
import { verticalConfig } from "@/config/verticals";
import { ContactsFilters } from "@/components/dashboard/ContactsFilters";
import { ExportCsvButton } from "@/components/dashboard/ExportCsvButton";
import { TopContactsTable } from "@/components/dashboard/TopContactsTable";

const PAGE_SIZE = 25;

type Props = {
  searchParams: Promise<{ q?: string; from?: string; to?: string; page?: string }>;
};

export default async function ConversationsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const search = sp.q?.trim() || undefined;
  const from = sp.from || undefined;
  const to = sp.to || undefined;
  const pageNum = Math.max(1, Number(sp.page) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const [rows, total] = await Promise.all([
    listContacts({ search, from, to, limit: PAGE_SIZE, offset }),
    countContacts({ search, from, to }),
  ]);
  const tenant = tenantConfig();
  const vertical = verticalConfig();

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/conversations${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-[28px] font-semibold leading-tight">Conversaciones</h1>
          <p className="text-sm text-[#6b7280]">Listado de contactos ordenado por última actividad.</p>
        </div>
        <ExportCsvButton
          endpoint="/api/export/conversations"
          params={{ from, to, search }}
        />
      </div>

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
    </div>
  );
}

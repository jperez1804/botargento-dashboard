import { notFound } from "next/navigation";
import {
  countProviders,
  listProviderCategories,
  selectProviders,
} from "@/db/views";
import { verticalConfig } from "@/config/verticals";
import { tenantConfig } from "@/config/tenant";
import { ProvidersFilters } from "@/components/dashboard/ProvidersFilters";
import { ProvidersTable } from "@/components/dashboard/ProvidersTable";
import { ExportCsvButton } from "@/components/dashboard/ExportCsvButton";
import { formatNumber } from "@/lib/format";

const PAGE_SIZE = 50;

type Props = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    zone?: string;
    status?: string;
    page?: string;
  }>;
};

export default async function ProvidersPage({ searchParams }: Props) {
  if (!verticalConfig().features?.providersTab) {
    notFound();
  }

  const sp = await searchParams;
  const search = sp.q?.trim() || undefined;
  const category = sp.category?.trim() || undefined;
  const zone = sp.zone?.trim() || undefined;
  const status = sp.status?.trim() || undefined;
  const pageNum = Math.max(1, Number(sp.page) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const [rows, total, categories] = await Promise.all([
    selectProviders({ search, category, zone, status, limit: PAGE_SIZE, offset }),
    countProviders({ search, category, zone, status }),
    listProviderCategories(),
  ]);
  const tenant = tenantConfig();

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (category) params.set("category", category);
    if (zone) params.set("zone", zone);
    if (status) params.set("status", status);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/providers${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <header className="space-y-3 border-b border-[var(--rule)] pb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)] font-[var(--font-geist-mono)]">
          Directorio
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-[30px] leading-[1.1] tracking-[-0.025em] text-[var(--ink)] font-semibold">
            Proveedores
          </h1>
          <div className="flex items-center gap-3">
            <p className="text-[13px] text-[var(--muted-ink)]">
              Dados de alta vía WhatsApp · {formatNumber(total, tenant.locale)} en total
            </p>
            <ExportCsvButton
              endpoint="/api/export/providers"
              params={{ search, category, zone, status }}
            />
          </div>
        </div>
      </header>

      <ProvidersFilters categories={categories} />

      <ProvidersTable
        rows={rows}
        locale={tenant.locale}
        timezone={tenant.timezone}
        brandName={tenant.name}
        page={pageNum}
        pageSize={PAGE_SIZE}
        total={total}
        buildPageHref={buildPageHref}
      />
    </div>
  );
}

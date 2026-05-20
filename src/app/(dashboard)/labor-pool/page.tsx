import { notFound } from "next/navigation";
import {
  countLaborPool,
  listLaborSpecialties,
  selectLaborPool,
} from "@/db/views";
import { verticalConfig } from "@/config/verticals";
import { tenantConfig } from "@/config/tenant";
import { LaborPoolFilters } from "@/components/dashboard/LaborPoolFilters";
import { LaborPoolTable } from "@/components/dashboard/LaborPoolTable";
import { ExportCsvButton } from "@/components/dashboard/ExportCsvButton";
import { formatNumber } from "@/lib/format";

const PAGE_SIZE = 50;

type Props = {
  searchParams: Promise<{
    q?: string;
    specialty?: string;
    zone?: string;
    mode?: string;
    status?: string;
    page?: string;
  }>;
};

export default async function LaborPoolPage({ searchParams }: Props) {
  if (!verticalConfig().features?.laborPoolTab) {
    notFound();
  }

  const sp = await searchParams;
  const search = sp.q?.trim() || undefined;
  const specialty = sp.specialty?.trim() || undefined;
  const zone = sp.zone?.trim() || undefined;
  const mode = sp.mode?.trim() || undefined;
  const status = sp.status?.trim() || undefined;
  const pageNum = Math.max(1, Number(sp.page) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const [rows, total, specialties] = await Promise.all([
    selectLaborPool({
      search,
      specialty,
      zone,
      mode,
      status,
      limit: PAGE_SIZE,
      offset,
    }),
    countLaborPool({ search, specialty, zone, mode, status }),
    listLaborSpecialties(),
  ]);
  const tenant = tenantConfig();

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (specialty) params.set("specialty", specialty);
    if (zone) params.set("zone", zone);
    if (mode) params.set("mode", mode);
    if (status) params.set("status", status);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/labor-pool${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-[28px] font-semibold leading-tight">Mano de obra</h1>
          <p className="text-sm text-[#6b7280]">
            Pool de oficios capturado vía WhatsApp.{" "}
            {formatNumber(total, tenant.locale)} en total.
          </p>
        </div>
        <ExportCsvButton
          endpoint="/api/export/labor-pool"
          params={{ search, specialty, zone, mode, status }}
        />
      </div>

      <LaborPoolFilters specialties={specialties} />

      <LaborPoolTable
        rows={rows}
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

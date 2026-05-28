import { Truck } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/dashboard/DataTable";
import { ContactRowActions } from "@/components/dashboard/ContactRowActions";
import { formatDateTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { ProviderRow } from "@/db/views";

type Props = {
  rows: ReadonlyArray<ProviderRow>;
  locale: string;
  timezone: string;
  brandName: string;
  page: number;
  pageSize: number;
  total: number;
  buildPageHref: (page: number) => string;
};

const STATUS_LABEL: Record<string, string> = {
  new: "Nuevo",
  approved: "Aprobado",
  rejected: "Rechazado",
};

// Status pill tones moved off the Tailwind palette (emerald-100, red-100,
// blue-100) and onto the semantic --positive-soft / --danger-soft /
// --info-soft tokens. Same intent; now dark-mode-correct and consistent
// with the priority / handoff-rate pills used elsewhere in the system.
const STATUS_TONE: Record<string, string> = {
  approved: "bg-[var(--positive-soft)] text-[var(--positive)]",
  rejected: "bg-[var(--danger-soft)] text-[var(--danger)]",
  new: "bg-[var(--info-soft)] text-[var(--info)]",
};

export function ProvidersTable({
  rows,
  locale,
  timezone,
  brandName,
  page,
  pageSize,
  total,
  buildPageHref,
}: Props) {
  const columns: ReadonlyArray<DataTableColumn<ProviderRow>> = [
    {
      id: "created",
      header: "Alta",
      width: "150px",
      cell: (r) => (
        <span className="tabular-nums text-[12.5px] text-[var(--muted-ink)] whitespace-nowrap">
          {formatDateTime(r.created_at, locale, timezone)}
        </span>
      ),
    },
    {
      id: "company",
      header: "Empresa",
      width: "minmax(0, 1.4fr)",
      cell: (r) => {
        const displayName = r.lead_name || r.profile_name || r.contact_wa_id;
        return (
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--ink)] truncate">
              {r.business_name || "—"}
            </div>
            {displayName !== r.business_name ? (
              <div className="text-[12px] text-[var(--soft-ink)] truncate">{displayName}</div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "category",
      header: "Rubro",
      width: "minmax(0, 1fr)",
      cell: (r) => (
        <span className="text-[13.5px] text-[var(--ink)] truncate">
          {r.category || "—"}
        </span>
      ),
    },
    {
      id: "zone",
      header: "Zona",
      width: "110px",
      cell: (r) => (
        <span className="text-[13.5px] text-[var(--muted-ink)]">{r.zone || "—"}</span>
      ),
    },
    {
      id: "contact",
      header: "Contacto",
      width: "minmax(0, 1.2fr)",
      cell: (r) => (
        <div className="min-w-0">
          <div className="text-[13.5px] text-[var(--ink)] truncate">{r.email || "—"}</div>
          {r.phone ? (
            <div className="text-[12px] text-[var(--soft-ink)] truncate font-[var(--font-geist-mono)]">
              {r.phone}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "Estado",
      width: "120px",
      cell: (r) => (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[11px] font-medium",
            STATUS_TONE[r.status] ?? "bg-[var(--neutral-soft)] text-[var(--muted-ink)]",
          )}
        >
          <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
          {STATUS_LABEL[r.status] ?? r.status}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Acciones",
      headerSrOnly: true,
      width: "120px",
      align: "right",
      cell: (r) => {
        const displayName = r.lead_name || r.profile_name || r.contact_wa_id;
        return (
          <ContactRowActions
            contactWaId={r.contact_wa_id}
            displayName={displayName}
            brandName={brandName}
            context="provider"
          />
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => String(r.id)}
      empty={{
        icon: <Truck className="size-[18px]" />,
        title: "No hay proveedores que coincidan",
        body: "Probá quitar algún filtro, ampliar la zona o limpiar la búsqueda.",
      }}
      minWidth={1040}
      pagination={{
        page,
        pageSize,
        total,
        buildPageHref,
        locale,
        rowsLabel: { singular: "proveedor", plural: "proveedores" },
      }}
    />
  );
}

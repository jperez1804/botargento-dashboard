import { HardHat } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/dashboard/DataTable";
import { ContactRowActions } from "@/components/dashboard/ContactRowActions";
import { formatDateTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { LaborPoolRow } from "@/db/views";

type Props = {
  rows: ReadonlyArray<LaborPoolRow>;
  locale: string;
  timezone: string;
  brandName: string;
  page: number;
  pageSize: number;
  total: number;
  buildPageHref: (page: number) => string;
};

const MODE_LABEL: Record<string, string> = {
  seeking: "Busca trabajo",
  offering: "Ofrece servicios",
};

const STATUS_LABEL: Record<string, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  archived: "Archivado",
};

const STATUS_TONE: Record<string, string> = {
  contacted: "bg-[var(--positive-soft)] text-[var(--positive)]",
  archived: "bg-[var(--neutral-soft)] text-[var(--muted-ink)]",
  new: "bg-[var(--info-soft)] text-[var(--info)]",
};

export function LaborPoolTable({
  rows,
  locale,
  timezone,
  brandName,
  page,
  pageSize,
  total,
  buildPageHref,
}: Props) {
  const columns: ReadonlyArray<DataTableColumn<LaborPoolRow>> = [
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
      id: "name",
      header: "Nombre",
      width: "minmax(0, 1.4fr)",
      cell: (r) => {
        const displayName =
          r.worker_name || r.lead_name || r.profile_name || r.contact_wa_id;
        return (
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--ink)] truncate">
              {displayName}
            </div>
            {r.contact_wa_id && displayName !== r.contact_wa_id ? (
              <div className="text-[12px] text-[var(--soft-ink)] truncate font-[var(--font-geist-mono)]">
                {r.contact_wa_id}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "specialty",
      header: "Especialidad",
      width: "minmax(0, 1fr)",
      cell: (r) => (
        <span className="text-[13.5px] text-[var(--ink)] truncate">
          {r.specialty || "—"}
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
      id: "mode",
      header: "Modalidad",
      width: "140px",
      cell: (r) => (
        <span className="text-[13.5px] text-[var(--ink)]">
          {MODE_LABEL[r.mode] ?? r.mode ?? "—"}
        </span>
      ),
    },
    {
      id: "phone",
      header: "Teléfono",
      width: "130px",
      cell: (r) => (
        <span className="text-[13px] text-[var(--muted-ink)] font-[var(--font-geist-mono)]">
          {r.phone || "—"}
        </span>
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
        const displayName =
          r.worker_name || r.lead_name || r.profile_name || r.contact_wa_id;
        return (
          <ContactRowActions
            contactWaId={r.contact_wa_id}
            displayName={displayName}
            brandName={brandName}
            context="labor"
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
        icon: <HardHat className="size-[18px]" />,
        title: "No hay registros que coincidan",
        body: "Probá quitar algún filtro o limpiar la búsqueda.",
      }}
      minWidth={1140}
      pagination={{
        page,
        pageSize,
        total,
        buildPageHref,
        locale,
        rowsLabel: { singular: "registro", plural: "registros" },
      }}
    />
  );
}

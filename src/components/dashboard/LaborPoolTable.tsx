import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContactRowActions } from "@/components/dashboard/ContactRowActions";
import { formatDateTime } from "@/lib/date";
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

function statusClass(s: string): string {
  if (s === "contacted") return "bg-emerald-100 text-emerald-800";
  if (s === "archived") return "bg-zinc-100 text-zinc-700";
  return "bg-blue-100 text-blue-800";
}

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
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-[var(--rule)] bg-[var(--surface)] p-6 text-sm text-[var(--muted-ink)]">
        No hay registros que coincidan con el filtro.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[var(--rule)] bg-[var(--surface)] overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium text-[var(--muted-ink)] uppercase tracking-wide">
                Alta
              </TableHead>
              <TableHead className="text-xs font-medium text-[var(--muted-ink)] uppercase tracking-wide">
                Nombre
              </TableHead>
              <TableHead className="text-xs font-medium text-[var(--muted-ink)] uppercase tracking-wide">
                Especialidad
              </TableHead>
              <TableHead className="text-xs font-medium text-[var(--muted-ink)] uppercase tracking-wide">
                Zona
              </TableHead>
              <TableHead className="text-xs font-medium text-[var(--muted-ink)] uppercase tracking-wide">
                Modalidad
              </TableHead>
              <TableHead className="text-xs font-medium text-[var(--muted-ink)] uppercase tracking-wide">
                Teléfono
              </TableHead>
              <TableHead className="text-xs font-medium text-[var(--muted-ink)] uppercase tracking-wide">
                Estado
              </TableHead>
              <TableHead className="text-right text-xs font-medium text-[var(--muted-ink)] uppercase tracking-wide">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const displayName =
                r.worker_name || r.lead_name || r.profile_name || r.contact_wa_id;
              return (
                <TableRow key={r.id} className="text-[13px]">
                  <TableCell className="tabular-nums whitespace-nowrap">
                    {formatDateTime(r.created_at, locale, timezone)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-[var(--ink)]">{displayName}</div>
                    {r.contact_wa_id && displayName !== r.contact_wa_id && (
                      <div className="text-xs text-[var(--soft-ink)]">{r.contact_wa_id}</div>
                    )}
                  </TableCell>
                  <TableCell>{r.specialty || "—"}</TableCell>
                  <TableCell>{r.zone || "—"}</TableCell>
                  <TableCell>{MODE_LABEL[r.mode] ?? r.mode ?? "—"}</TableCell>
                  <TableCell>{r.phone || "—"}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(r.status)}`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <ContactRowActions
                      contactWaId={r.contact_wa_id}
                      displayName={displayName}
                      brandName={brandName}
                      context="labor"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between border-t border-[var(--rule)] px-4 py-2 text-xs text-[var(--muted-ink)]">
        <div>
          Página {page} de {totalPages} · {total} {total === 1 ? "registro" : "registros"}
        </div>
        <div className="flex items-center gap-1">
          {page <= 1 ? (
            <span className="inline-flex h-8 w-8 items-center justify-center text-[var(--soft-ink)] opacity-50">
              <ChevronLeft className="size-4" />
              <span className="sr-only">Anterior</span>
            </span>
          ) : (
            <Link
              href={buildPageHref(page - 1)}
              prefetch={false}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--canvas)] text-[var(--ink)]"
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">Anterior</span>
            </Link>
          )}
          {page >= totalPages ? (
            <span className="inline-flex h-8 w-8 items-center justify-center text-[var(--soft-ink)] opacity-50">
              <ChevronRight className="size-4" />
              <span className="sr-only">Siguiente</span>
            </span>
          ) : (
            <Link
              href={buildPageHref(page + 1)}
              prefetch={false}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--canvas)] text-[var(--ink)]"
            >
              <ChevronRight className="size-4" />
              <span className="sr-only">Siguiente</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

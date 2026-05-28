"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/date";
import { formatAutomationLabel } from "@/lib/automation-labels";
import type { HandoffRow } from "@/lib/queries/handoffs";
import type { HandoffPriority, HandoffTargetDef } from "@/config/verticals/_types";

type Props = {
  data: ReadonlyArray<HandoffRow>;
  targets: ReadonlyArray<HandoffTargetDef>;
  locale: string;
  timezone: string;
};

// Grid template for ALL rows (header + data). Last column (32px) holds the
// chevron on data rows and stays empty in the header. Min-width on the
// container keeps columns from collapsing when the viewport is narrow.
const GRID_COLS =
  "minmax(160px,180px) minmax(140px,160px) minmax(0,1.4fr) minmax(140px,160px) minmax(0,1.5fr) 28px";

const PRIORITY: Record<
  HandoffPriority,
  { chip: string; label: string; tier: string }
> = {
  1: { chip: "bg-[var(--danger-soft)] text-[var(--danger)]", label: "Urgente", tier: "T1" },
  2: { chip: "bg-[var(--warning-soft)] text-[var(--warning)]", label: "Alto valor", tier: "T2" },
  3: { chip: "bg-[var(--info-soft)] text-[var(--info)]", label: "Calificado", tier: "T3" },
  4: { chip: "bg-[var(--neutral-soft)] text-[var(--muted-ink)]", label: "Captura", tier: "T4" },
};

function resolveTarget(
  target: string,
  defs: ReadonlyArray<HandoffTargetDef>,
): HandoffTargetDef | undefined {
  const lower = target.toLowerCase();
  return defs.find((d) => lower.includes(d.match.toLowerCase()));
}

function friendlyName(target: string, defs: ReadonlyArray<HandoffTargetDef>): string {
  const hit = resolveTarget(target, defs);
  return hit?.label ?? formatAutomationLabel(target) ?? target;
}

function priorityOf(
  target: string,
  defs: ReadonlyArray<HandoffTargetDef>,
): HandoffPriority {
  return resolveTarget(target, defs)?.priority ?? 3;
}

function PriorityPill({ priority }: { priority: HandoffPriority }) {
  const t = PRIORITY[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[11px] font-medium whitespace-nowrap",
        t.chip,
      )}
      title={`Tier ${priority} — ${t.label}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {t.tier} · {t.label}
    </span>
  );
}

export function HandoffsTable({ data, targets, locale, timezone }: Props) {
  // Default sort: priority ascending (T1 first), then most recent within tier.
  const [sorting, setSorting] = useState<SortingState>([
    { id: "priority", desc: false },
    { id: "createdAt", desc: true },
  ]);

  const columns = useMemo<ColumnDef<HandoffRow>[]>(
    () => [
      {
        id: "priority",
        accessorFn: (r) => priorityOf(r.target, targets),
        header: "Prioridad",
        cell: (ctx) => <PriorityPill priority={ctx.getValue() as HandoffPriority} />,
        sortingFn: "basic",
      },
      {
        accessorKey: "createdAt",
        header: "Fecha",
        cell: (ctx) => (
          <span className="text-[12.5px] text-[var(--muted-ink)] tabular-nums">
            {formatDateTime(String(ctx.getValue()), locale, timezone)}
          </span>
        ),
      },
      {
        id: "contact",
        accessorFn: (r) => r.displayName ?? r.contactWaId,
        header: "Contacto",
        cell: (ctx) => {
          const row = ctx.row.original;
          return (
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--ink)] truncate">
                {row.displayName ?? row.contactWaId}
              </div>
              {row.displayName ? (
                <div className="text-[12px] text-[var(--soft-ink)] truncate font-[var(--font-geist-mono)]">
                  {row.contactWaId}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "target",
        header: "Derivado a",
        cell: (ctx) => (
          <span className="text-[13.5px] text-[var(--ink)] truncate">
            {friendlyName(String(ctx.getValue()), targets)}
          </span>
        ),
      },
      {
        accessorKey: "reason",
        header: "Motivo",
        cell: (ctx) => (
          <span className="text-[12.5px] text-[var(--muted-ink)] truncate">
            {formatAutomationLabel(ctx.getValue() as string | null) ?? "—"}
          </span>
        ),
        enableSorting: false,
      },
    ],
    [locale, timezone, targets],
  );

  const table = useReactTable({
    data: data as HandoffRow[],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<Filter className="size-[18px]" />}
        title="Sin derivaciones en este período"
        body="Aún no se registraron derivaciones para la ventana actual. Cuando el bot derive un contacto al equipo humano, aparecerá acá."
      />
    );
  }

  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const pageCount = Math.max(1, table.getPageCount());
  const pageStart = pageIndex * pageSize + 1;
  const pageEnd = Math.min((pageIndex + 1) * pageSize, data.length);

  return (
    <div className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          {/* Header band */}
          <div
            className="grid items-center gap-3 px-5 py-3 bg-[var(--surface-2)] border-b border-[var(--rule)]"
            style={{ gridTemplateColumns: GRID_COLS }}
            role="rowgroup"
          >
            {table.getHeaderGroups()[0]?.headers.map((h) => {
              const sortable = h.column.getCanSort();
              const dir = h.column.getIsSorted();
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={sortable ? h.column.getToggleSortingHandler() : undefined}
                  disabled={!sortable}
                  className={cn(
                    "text-[11px] font-medium tracking-[0.08em] uppercase flex items-center gap-1 text-left",
                    "focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-2 rounded",
                    dir ? "text-[var(--ink)]" : "text-[var(--soft-ink)]",
                    sortable && "cursor-pointer hover:text-[var(--ink)]",
                    !sortable && "cursor-default",
                  )}
                  aria-sort={
                    dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"
                  }
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {dir === "asc" && <ArrowUp className="size-3" aria-hidden="true" />}
                  {dir === "desc" && <ArrowDown className="size-3" aria-hidden="true" />}
                </button>
              );
            })}
            <div />
          </div>

          {/* Rows — whole row is a Link to the contact's conversation thread. */}
          {table.getRowModel().rows.map((row) => {
            const r = row.original;
            return (
              <Link
                key={row.id}
                href={`/conversations/${r.contactWaId}`}
                className={cn(
                  "group/row grid items-center gap-3 px-5 py-3.5 border-b border-[var(--rule)] last:border-b-0",
                  "hover:bg-[var(--canvas-2)] transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-[-2px]",
                )}
                style={{ gridTemplateColumns: GRID_COLS }}
                aria-label={`Abrir conversación con ${r.displayName ?? r.contactWaId}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <div key={cell.id} className="min-w-0">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
                <ChevronRight
                  className="size-[14px] text-[var(--soft-ink)] group-hover/row:text-[var(--ink)] transition-colors"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Pagination footer — surface-2 band matching the header. */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--rule)] bg-[var(--surface-2)] px-5 py-3 text-[12.5px] text-[var(--muted-ink)]">
        <span>
          Mostrando {pageStart}–{pageEnd} de {data.length}
        </span>
        <div className="inline-flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Página anterior"
            className="w-7 px-0"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="tabular-nums min-w-[40px] text-center">
            {pageIndex + 1} / {pageCount}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Página siguiente"
            className="w-7 px-0"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

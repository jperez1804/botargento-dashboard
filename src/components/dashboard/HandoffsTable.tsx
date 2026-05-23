"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

const PRIORITY_LABEL: Record<HandoffPriority, string> = {
  1: "Urgente",
  2: "Alto valor",
  3: "Calificado",
  4: "Captura",
};

const PRIORITY_CLASS: Record<HandoffPriority, string> = {
  1: "bg-red-100 text-red-800",
  2: "bg-orange-100 text-orange-800",
  3: "bg-blue-100 text-blue-800",
  4: "bg-zinc-100 text-zinc-700",
};

function PriorityBadge({ priority }: { priority: HandoffPriority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        PRIORITY_CLASS[priority],
      )}
      title={`Tier ${priority} — ${PRIORITY_LABEL[priority]}`}
    >
      T{priority} · {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function HandoffsTable({ data, targets, locale, timezone }: Props) {
  // Default: tier ascending (urgent first), then most recent first within tier.
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
        cell: (ctx) => <PriorityBadge priority={ctx.getValue() as HandoffPriority} />,
        sortingFn: "basic",
      },
      {
        accessorKey: "createdAt",
        header: "Fecha",
        cell: (ctx) => (
          <span className="tabular-nums">
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
              <div className="font-medium text-[var(--ink)] truncate">
                {row.displayName ?? row.contactWaId}
              </div>
              {row.displayName && (
                <div className="text-xs text-[var(--soft-ink)] truncate">{row.contactWaId}</div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "target",
        header: "Derivado a",
        cell: (ctx) => friendlyName(String(ctx.getValue()), targets),
      },
      {
        accessorKey: "reason",
        header: "Motivo",
        cell: (ctx) => (
          <span className="text-[var(--ink)]">
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
      <div className="rounded-md border border-[var(--rule)] bg-[var(--surface)] p-6 text-sm text-[var(--muted-ink)]">
        No hay derivaciones en este período.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[var(--rule)] bg-[var(--surface)] overflow-hidden">
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((h) => {
                const sortable = h.column.getCanSort();
                const dir = h.column.getIsSorted();
                return (
                  <TableHead
                    key={h.id}
                    onClick={sortable ? h.column.getToggleSortingHandler() : undefined}
                    className={cn(
                      "text-xs font-medium text-[var(--muted-ink)] uppercase tracking-wide",
                      sortable && "cursor-pointer select-none",
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {dir === "asc" && <ArrowUp className="size-3" />}
                      {dir === "desc" && <ArrowDown className="size-3" />}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className="text-[13px]">
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
      <div className="flex items-center justify-between border-t border-[var(--rule)] px-4 py-2 text-xs text-[var(--muted-ink)]">
        <div>
          Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount() || 1}
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="size-4" />
            <span className="sr-only">Anterior</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="size-4" />
            <span className="sr-only">Siguiente</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

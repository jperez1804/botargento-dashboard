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
import type { HandoffTargetDef } from "@/config/verticals/_types";

type Props = {
  data: ReadonlyArray<HandoffRow>;
  targets: ReadonlyArray<HandoffTargetDef>;
  locale: string;
  timezone: string;
};

function friendlyName(target: string, defs: ReadonlyArray<HandoffTargetDef>): string {
  const lower = target.toLowerCase();
  const hit = defs.find((d) => lower.includes(d.match.toLowerCase()));
  return hit?.label ?? formatAutomationLabel(target) ?? target;
}

export function HandoffsTable({ data, targets, locale, timezone }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);

  const columns = useMemo<ColumnDef<HandoffRow>[]>(
    () => [
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
              <div className="font-medium text-[#111827] truncate">
                {row.displayName ?? row.contactWaId}
              </div>
              {row.displayName && (
                <div className="text-xs text-[#9ca3af] truncate">{row.contactWaId}</div>
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
          <span className="text-[#374151]">
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
      <div className="rounded-md border border-[#e5e7eb] bg-white p-6 text-sm text-[#6b7280]">
        No hay derivaciones en este período.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[#e5e7eb] bg-white overflow-hidden">
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
                      "text-xs font-medium text-[#6b7280] uppercase tracking-wide",
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
      <div className="flex items-center justify-between border-t border-[#e5e7eb] px-4 py-2 text-xs text-[#6b7280]">
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

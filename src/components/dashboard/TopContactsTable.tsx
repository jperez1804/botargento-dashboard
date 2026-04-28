// Server component — table is purely presentational. Pagination is driven
// by URL search params (read by the page, materialized as ?page=N links here).

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
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/date";
import { formatNumber } from "@/lib/format";
import { formatAutomationLabel } from "@/lib/automation-labels";
import type { ContactSummary } from "@/lib/queries/contacts";
import type { IntentDef } from "@/config/verticals/_types";

type Props = {
  rows: ReadonlyArray<ContactSummary>;
  intents: ReadonlyArray<IntentDef>;
  locale: string;
  timezone: string;
  page: number;
  pageSize: number;
  total: number;
  buildPageHref: (page: number) => string;
};

function intentLabel(value: string | null, intents: ReadonlyArray<IntentDef>): string | null {
  if (!value) return null;
  const hit = intents.find((i) => i.key.toLowerCase() === value.toLowerCase());
  return hit?.label ?? formatAutomationLabel(value) ?? value;
}

function intentColor(value: string | null, intents: ReadonlyArray<IntentDef>): string {
  if (!value) return "#94a3b8";
  const hit = intents.find((i) => i.key.toLowerCase() === value.toLowerCase());
  return hit?.color ?? "#94a3b8";
}

export function TopContactsTable({
  rows,
  intents,
  locale,
  timezone,
  page,
  pageSize,
  total,
  buildPageHref,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-[#e5e7eb] bg-white p-6 text-sm text-[#6b7280]">
        No hay conversaciones en este rango.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[#e5e7eb] bg-white overflow-hidden">
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs font-medium text-[#6b7280] uppercase tracking-wide">
              Contacto
            </TableHead>
            <TableHead className="text-xs font-medium text-[#6b7280] uppercase tracking-wide">
              Última intención
            </TableHead>
            <TableHead className="text-xs font-medium text-[#6b7280] uppercase tracking-wide text-right">
              Mensajes
            </TableHead>
            <TableHead className="text-xs font-medium text-[#6b7280] uppercase tracking-wide text-right">
              Derivaciones
            </TableHead>
            <TableHead className="text-xs font-medium text-[#6b7280] uppercase tracking-wide">
              Último contacto
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const intent = intentLabel(row.lastIntent, intents);
            const color = intentColor(row.lastIntent, intents);
            return (
              <TableRow key={row.contactWaId} className="text-[13px]">
                <TableCell>
                  <Link
                    href={`/conversations/${row.contactWaId}`}
                    className="block min-w-0 hover:text-[var(--client-primary)]"
                  >
                    <div className="font-medium text-[#111827] truncate">
                      {row.displayName ?? row.contactWaId}
                    </div>
                    {row.displayName && (
                      <div className="text-xs text-[#9ca3af] truncate">{row.contactWaId}</div>
                    )}
                  </Link>
                </TableCell>
                <TableCell>
                  {intent ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
                      style={{ background: `${color}1F`, color }}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: color }}
                        aria-hidden="true"
                      />
                      {intent}
                    </span>
                  ) : (
                    <span className="text-[#9ca3af]">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(row.messageCount, locale)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    row.handoffCount > 0 ? "text-[#111827]" : "text-[#9ca3af]",
                  )}
                >
                  {formatNumber(row.handoffCount, locale)}
                </TableCell>
                <TableCell className="tabular-nums whitespace-nowrap">
                  {formatDateTime(row.lastSeen, locale, timezone)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
      <div className="flex items-center justify-between border-t border-[#e5e7eb] px-4 py-2 text-xs text-[#6b7280]">
        <div>
          Mostrando {formatNumber(start, locale)}–{formatNumber(end, locale)} de{" "}
          {formatNumber(total, locale)}
        </div>
        <div className="flex items-center gap-1">
          {page <= 1 ? (
            <span className="inline-flex h-8 w-8 items-center justify-center text-[#d1d5db]">
              <ChevronLeft className="size-4" />
              <span className="sr-only">Anterior</span>
            </span>
          ) : (
            <Link
              href={buildPageHref(page - 1)}
              prefetch={false}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#f3f4f6] text-[#374151]"
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">Anterior</span>
            </Link>
          )}
          <span className="px-2 self-center tabular-nums">
            {page} / {totalPages}
          </span>
          {page >= totalPages ? (
            <span className="inline-flex h-8 w-8 items-center justify-center text-[#d1d5db]">
              <ChevronRight className="size-4" />
              <span className="sr-only">Siguiente</span>
            </span>
          ) : (
            <Link
              href={buildPageHref(page + 1)}
              prefetch={false}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#f3f4f6] text-[#374151]"
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

// Shared read-only data table primitive. Powers Conversaciones, Proveedores,
// Mano de obra (and any future listing page) with the new operator-console
// table treatment: surface-2 header band, hairline row dividers, no zebra,
// whole-row Link affordance, surface-2 footer band with URL-driven pagination.
//
// Why not extend HandoffsTable? Handoffs uses TanStack Table for client-side
// sort + pagination state; everything else here paginates via URL params
// (server-rendered). Different state models, same visual language. The
// HandoffsTable component shares the styling via this file's tokens but not
// the implementation.

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber } from "@/lib/format";

export type DataTableColumn<T> = {
  /** Stable key for React. Becomes the column's grid track id. */
  id: string;
  header: ReactNode;
  /** CSS grid track segment — e.g. "150px" / "minmax(0,1fr)" / "120px". */
  width: string;
  /** Render the cell. Receives the row. */
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  /** Hide the column header text. Useful for action columns. */
  headerSrOnly?: boolean;
};

export type DataTableEmpty = {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
};

type Props<T> = {
  columns: ReadonlyArray<DataTableColumn<T>>;
  rows: ReadonlyArray<T>;
  rowKey: (row: T) => string;
  /** If supplied, the whole row renders as a <Link> to this href. */
  rowHref?: (row: T) => string;
  /** Optional ARIA label override per row. */
  rowAriaLabel?: (row: T) => string;
  /** Empty state shown when rows.length === 0. */
  empty: DataTableEmpty;
  /** Min-width for the inner table when scrolling horizontally. */
  minWidth?: number;
  /** URL-driven pagination. Omit to render no footer. */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    buildPageHref: (page: number) => string;
    locale: string;
    /** Singular/plural noun for the total — "proveedor" / "proveedores". */
    rowsLabel?: { singular: string; plural: string };
  };
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  rowAriaLabel,
  empty,
  minWidth = 860,
  pagination,
}: Props<T>) {
  if (rows.length === 0) {
    return <EmptyState {...empty} />;
  }

  const gridTemplate = columns.map((c) => c.width).join(" ");

  return (
    <div className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth }}>
          {/* Header band */}
          <div
            role="rowgroup"
            className="grid items-center gap-3 px-5 py-3 bg-[var(--surface-2)] border-b border-[var(--rule)]"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {columns.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "text-[11px] font-medium tracking-[0.08em] uppercase text-[var(--soft-ink)]",
                  c.align === "right" ? "text-right" : "text-left",
                )}
              >
                <span className={c.headerSrOnly ? "sr-only" : undefined}>
                  {c.header}
                </span>
              </div>
            ))}
          </div>

          {/* Rows */}
          {rows.map((row) => {
            const cells = (
              <>
                {columns.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      "min-w-0",
                      c.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {c.cell(row)}
                  </div>
                ))}
              </>
            );
            const baseRow =
              "group/row grid items-center gap-3 px-5 py-3.5 border-b border-[var(--rule)] last:border-b-0 text-[13.5px] text-[var(--ink)]";
            if (rowHref) {
              return (
                <Link
                  key={rowKey(row)}
                  href={rowHref(row)}
                  aria-label={rowAriaLabel?.(row)}
                  className={cn(
                    baseRow,
                    "hover:bg-[var(--canvas-2)] transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-[-2px]",
                  )}
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  {cells}
                </Link>
              );
            }
            return (
              <div
                key={rowKey(row)}
                className={baseRow}
                style={{ gridTemplateColumns: gridTemplate }}
              >
                {cells}
              </div>
            );
          })}
        </div>
      </div>

      {pagination ? <PaginationFooter {...pagination} /> : null}
    </div>
  );
}

function PaginationFooter({
  page,
  pageSize,
  total,
  buildPageHref,
  locale,
  rowsLabel,
}: NonNullable<Props<unknown>["pagination"]>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  const summary =
    rowsLabel && totalPages === 1
      ? `${formatNumber(total, locale)} ${total === 1 ? rowsLabel.singular : rowsLabel.plural}`
      : `Mostrando ${formatNumber(start, locale)}–${formatNumber(end, locale)} de ${formatNumber(total, locale)}`;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--rule)] bg-[var(--surface-2)] px-5 py-3 text-[12.5px] text-[var(--muted-ink)]">
      <span>{summary}</span>
      <div className="inline-flex items-center gap-1.5">
        <PagerLink
          href={atStart ? null : buildPageHref(page - 1)}
          label="Página anterior"
          icon={<ChevronLeft className="size-4" />}
        />
        <span className="tabular-nums min-w-[40px] text-center">
          {page} / {totalPages}
        </span>
        <PagerLink
          href={atEnd ? null : buildPageHref(page + 1)}
          label="Página siguiente"
          icon={<ChevronRight className="size-4" />}
        />
      </div>
    </div>
  );
}

function PagerLink({
  href,
  label,
  icon,
}: {
  href: string | null;
  label: string;
  icon: ReactNode;
}) {
  // Disabled (no-href) renders as a span at 40% opacity so the layout doesn't
  // shift between active/disabled. Active renders as a 7×7 px ghost button.
  if (!href) {
    return (
      <span
        aria-disabled
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--rule)] text-[var(--soft-ink)] opacity-40"
      >
        {icon}
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--rule)] bg-[var(--surface)] text-[var(--muted-ink)] hover:text-[var(--ink)] hover:bg-[var(--canvas-2)] focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-2 transition-colors"
    >
      {icon}
    </Link>
  );
}

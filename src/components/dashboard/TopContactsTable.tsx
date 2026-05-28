// Server component — table is purely presentational. Pagination is driven
// by URL search params (read by the page, materialized as ?page=N links here).

import { MessageSquare } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/dashboard/DataTable";
import { formatDateTime } from "@/lib/date";
import { formatNumber } from "@/lib/format";
import { formatAutomationLabel } from "@/lib/automation-labels";
import { cn } from "@/lib/utils";
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
  const columns: ReadonlyArray<DataTableColumn<ContactSummary>> = [
    {
      id: "contact",
      header: "Contacto",
      width: "minmax(0, 1.6fr)",
      cell: (r) => (
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--ink)] truncate">
            {r.displayName ?? r.contactWaId}
          </div>
          {r.displayName ? (
            <div className="text-[12px] text-[var(--soft-ink)] truncate font-[var(--font-geist-mono)]">
              {r.contactWaId}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "intent",
      header: "Última intención",
      width: "minmax(0, 1fr)",
      cell: (r) => {
        const intent = intentLabel(r.lastIntent, intents);
        return intent ? (
          // Last-intent uses an info-toned pill — informational, not a
          // status. Tier semantics are reserved for Derivaciones priorities.
          <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full bg-[var(--info-soft)] text-[var(--info)] text-[11.5px] font-medium">
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            {intent}
          </span>
        ) : (
          <span className="text-[var(--soft-ink)]">—</span>
        );
      },
    },
    {
      id: "messages",
      header: "Mensajes",
      width: "110px",
      align: "right",
      cell: (r) => (
        <span className="tabular-nums text-[13.5px] text-[var(--ink)]">
          {formatNumber(r.messageCount, locale)}
        </span>
      ),
    },
    {
      id: "handoffs",
      header: "Derivaciones",
      width: "130px",
      align: "right",
      cell: (r) => (
        <span
          className={cn(
            "tabular-nums text-[13.5px]",
            r.handoffCount > 0 ? "text-[var(--ink)]" : "text-[var(--faint-ink)]",
          )}
        >
          {formatNumber(r.handoffCount, locale)}
        </span>
      ),
    },
    {
      id: "last",
      header: "Último contacto",
      width: "170px",
      cell: (r) => (
        <span className="tabular-nums text-[12.5px] text-[var(--muted-ink)] whitespace-nowrap">
          {formatDateTime(r.lastSeen, locale, timezone)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.contactWaId}
      rowHref={(r) => `/conversations/${r.contactWaId}`}
      rowAriaLabel={(r) =>
        `Abrir conversación con ${r.displayName ?? r.contactWaId}`
      }
      empty={{
        icon: <MessageSquare className="size-[18px]" />,
        title: "Sin conversaciones en este rango",
        body: "Probá ampliar el rango de fechas o quitar la búsqueda actual.",
      }}
      pagination={{
        page,
        pageSize,
        total,
        buildPageHref,
        locale,
        rowsLabel: { singular: "contacto", plural: "contactos" },
      }}
    />
  );
}

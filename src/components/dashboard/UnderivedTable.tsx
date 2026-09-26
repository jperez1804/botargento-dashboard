// Conversaciones → "Sin derivar": people who wrote about something the bot
// recognised but never handed over, so no opportunity opened. One click turns
// any of them into one, with the rubro already filled in.

import { MessageCircleQuestion } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/dashboard/DataTable";
import { OpenOpportunityButton } from "@/components/dashboard/OpenOpportunityButton";
import { formatDateTime } from "@/lib/date";
import { leadIntent } from "@/lib/crm/intent";
import type { CrmConfig, IntentDef } from "@/config/verticals/_types";
import type { UnderivedConversation } from "@/lib/queries/underived";

type Props = {
  rows: ReadonlyArray<UnderivedConversation>;
  config: CrmConfig;
  intents: ReadonlyArray<IntentDef>;
  locale: string;
  timezone: string;
  canEdit: boolean;
  page: number;
  pageSize: number;
  total: number;
  buildPageHref: (page: number) => string;
};

export function UnderivedTable({
  rows,
  config,
  intents,
  locale,
  timezone,
  canEdit,
  page,
  pageSize,
  total,
  buildPageHref,
}: Props) {
  const labels = config.labels;
  const columns: ReadonlyArray<DataTableColumn<UnderivedConversation>> = [
    {
      id: "contact",
      header: "Contacto",
      width: "minmax(0, 1.6fr)",
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-[var(--ink)]">{r.displayName}</div>
          <div className="truncate font-[var(--font-geist-mono)] text-[12px] tabular-nums text-[var(--soft-ink)]">
            {r.contactWaId}
          </div>
        </div>
      ),
    },
    {
      id: "kind",
      header: labels.opportunity.kindLabel,
      width: "minmax(0, 0.8fr)",
      // Reply mode has no rubro for a conversation; an empty pill reads as a glitch.
      cell: (r) =>
        r.kind === "" ? null : (
          <span
            data-testid="underived-kind"
            className="inline-flex h-[22px] items-center rounded-full bg-[var(--info-soft)] px-2 text-[11.5px] font-medium text-[color-mix(in_oklch,var(--info)_75%,var(--ink))]"
          >
            {leadIntent(r.kind, intents)?.label ?? r.kind}
          </span>
        ),
    },
    {
      id: "last",
      header: labels.columnLastActivity,
      width: "minmax(0, 0.9fr)",
      cell: (r) => (
        <span className="tabular-nums text-[var(--muted-ink)]">
          {formatDateTime(r.lastInboundAt.toISOString(), locale, timezone)}
        </span>
      ),
    },
    {
      id: "action",
      header: "",
      width: "minmax(0, 0.7fr)",
      cell: (r) =>
        canEdit ? (
          <OpenOpportunityButton
            contactWaId={r.contactWaId}
            kind={r.kind}
            labels={labels}
            size="xs"
          />
        ) : null,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.contactWaId}
      rowHref={(r) => `/conversations/${encodeURIComponent(r.contactWaId)}`}
      rowAriaLabel={(r) => `${labels.opportunity.underivedTitle}: ${r.displayName}`}
      empty={{
        icon: <MessageCircleQuestion className="size-5" aria-hidden />,
        title: labels.opportunity.underivedEmpty,
      }}
      minWidth={760}
      pagination={{
        page,
        pageSize,
        total,
        buildPageHref,
        locale,
        rowsLabel: { singular: "conversación", plural: "conversaciones" },
      }}
    />
  );
}

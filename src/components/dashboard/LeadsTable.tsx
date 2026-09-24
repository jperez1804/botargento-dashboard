// /leads list view on the shared DataTable: each row opens the conversation,
// where the CRM card lives. Status lines (por vencer / perdido) and overdue
// reminders carry semantic color so what needs attention reads at a glance.

import { SquareKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { DataTable, type DataTableColumn } from "@/components/dashboard/DataTable";
import { LeadStageChip } from "@/components/dashboard/LeadStageChip";
import { LeadPriorityChip } from "@/components/dashboard/LeadPriorityChip";
import type { CrmLabels } from "@/config/verticals/_types";
import type { LeadView } from "@/lib/crm/view-model";

export type LeadTableRow = {
  id: number;
  waId: string;
  displayName: string;
  seq: number;
  ofTotal: number;
  view: LeadView;
  // Origin of a lead registered by hand; null = came through WhatsApp.
  sourceLabel: string | null;
  intentLabel: string | null;
};

type Props = {
  rows: ReadonlyArray<LeadTableRow>;
  labels: CrmLabels;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    buildPageHref: (page: number) => string;
    locale: string;
  };
};

export function LeadsTable({ rows, labels, pagination }: Props) {
  const columns: ReadonlyArray<DataTableColumn<LeadTableRow>> = [
    {
      id: "contact",
      header: labels.columnContact,
      width: "minmax(0,1.4fr)",
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-medium truncate">{r.displayName}</p>
          <p className="text-[12px] text-[var(--soft-ink)] tabular-nums font-[var(--font-geist-mono)]">
            {r.waId}
            {r.sourceLabel ? (
              <span className="ml-2 font-[var(--font-geist-sans)] text-[var(--muted-ink)]">
                · {r.sourceLabel}
              </span>
            ) : null}
            {r.intentLabel ? (
              <span
                data-testid="lead-intent"
                className="ml-2 font-[var(--font-geist-sans)] font-medium text-[var(--info)]"
              >
                · {r.intentLabel}
              </span>
            ) : null}
          </p>
        </div>
      ),
    },
    {
      id: "stage",
      header: labels.columnStage,
      width: "140px",
      cell: (r) => (
        <div className="flex flex-col items-start gap-1">
          <LeadStageChip
            label={r.view.stageLabel}
            tone={r.view.tone}
            auto={r.view.auto}
            autoTitle={labels.autoStageDetail}
          />
          {r.view.priority ? (
            <LeadPriorityChip label={r.view.priority.label} tone={r.view.priority.tone} />
          ) : null}
        </div>
      ),
    },
    {
      id: "budget",
      header: labels.columnBudget,
      width: "minmax(0,0.9fr)",
      cell: (r) =>
        r.view.budgetText ? (
          <span className="block truncate tabular-nums">{r.view.budgetText}</span>
        ) : (
          <span className="text-[var(--faint-ink)]">—</span>
        ),
    },
    {
      id: "owner",
      header: labels.columnOwner,
      width: "minmax(0,1fr)",
      cell: (r) => (
        <span className={cn("truncate block", !r.view.ownerEmail && "text-[var(--soft-ink)] italic")}>
          {r.view.ownerLabel}
        </span>
      ),
    },
    {
      id: "activity",
      header: labels.columnLastActivity,
      width: "minmax(0,1.1fr)",
      cell: (r) => (
        <div className="min-w-0">
          <p className="tabular-nums text-[var(--muted-ink)]">{r.view.lastActivityText}</p>
          {r.view.statusText ? (
            <p
              className={cn(
                "text-[12px] font-medium truncate",
                r.view.statusTone === "danger"
                  ? "text-[var(--danger)]"
                  : "text-[color-mix(in_oklch,var(--warning)_70%,var(--ink))]",
              )}
            >
              {r.view.statusText}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "next",
      header: labels.columnNextStep,
      width: "minmax(0,1.2fr)",
      cell: (r) => {
        const rem = r.view.reminder;
        if (!rem || rem.status === "done") return <span className="text-[var(--faint-ink)]">—</span>;
        return (
          <div className="min-w-0">
            <p
              className={cn(
                "tabular-nums text-[12.5px] font-medium",
                rem.status === "overdue" ? "text-[var(--danger)]" : "text-[var(--ink)]",
              )}
            >
              {rem.text}
            </p>
            {rem.note ? <p className="text-[12px] text-[var(--muted-ink)] truncate">{rem.note}</p> : null}
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => String(r.id)}
      rowHref={(r) => `/conversations/${encodeURIComponent(r.waId)}?op=${r.id}`}
      rowAriaLabel={(r) => `${labels.pageTitle}: ${r.displayName}`}
      empty={{ icon: <SquareKanban className="size-5" aria-hidden />, title: labels.emptyLeads }}
      minWidth={1000}
      pagination={pagination}
    />
  );
}

// The list, grouped by person: one row per contact, their opportunities
// nested inside. A Kanban cannot group across columns, so this is where you
// see at a glance that the same person has a rental in Visita and a sale in
// Calificado.
//
// Native <details>: no client JavaScript, and the browser keeps the toggle.
// Groups with more than one opportunity start open, because that is the whole
// reason to be in this view.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SquareKanban } from "lucide-react";
import { LeadStageChip } from "@/components/dashboard/LeadStageChip";
import { LeadPriorityChip } from "@/components/dashboard/LeadPriorityChip";
import { LeadAvatar } from "@/components/dashboard/LeadAvatar";
import { fillTemplate } from "@/lib/crm/view-model";
import { cn } from "@/lib/utils";
import type { CrmLabels } from "@/config/verticals/_types";
import type { LeadView } from "@/lib/crm/view-model";

export type GroupedLeadRow = {
  id: number;
  seq: number;
  kindLabel: string | null;
  title: string;
  view: LeadView;
};

export type LeadGroup = {
  contactWaId: string;
  displayName: string;
  rows: GroupedLeadRow[];
};

type Props = {
  groups: ReadonlyArray<LeadGroup>;
  labels: CrmLabels;
};

export function LeadsGroupedList({ groups, labels }: Props) {
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<SquareKanban className="size-5" aria-hidden />}
        title={labels.emptyLeads}
      />
    );
  }

  return (
    <Card data-testid="leads-grouped">
      <CardContent className="p-0">
        <ul className="divide-y divide-[var(--rule)]">
          {groups.map((group) => (
            <li key={group.contactWaId}>
              <details open={group.rows.length > 1} data-testid="lead-group" data-wa={group.contactWaId}>
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 hover:bg-[var(--canvas-2)] [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    className="size-4 shrink-0 text-[var(--soft-ink)] transition-transform duration-150 group-open:rotate-90 [details[open]_&]:rotate-90"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-[var(--ink)]">
                    {group.displayName}
                  </span>
                  <span className="shrink-0 font-[var(--font-geist-mono)] text-[12px] tabular-nums text-[var(--soft-ink)]">
                    {group.contactWaId}
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-[var(--muted-ink)]">
                    {group.rows.length === 1
                      ? labels.opportunity.oneOpportunity
                      : fillTemplate(labels.opportunity.manyOpportunities, { n: group.rows.length })}
                  </span>
                </summary>

                <ul className="space-y-1 px-4 pb-3 pl-10">
                  {group.rows.map((row) => (
                    <li key={row.id}>
                      <Link
                        href={`/conversations/${encodeURIComponent(group.contactWaId)}?op=${row.id}`}
                        data-testid="grouped-opportunity"
                        data-opportunity={row.id}
                        className={cn(
                          "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-2 py-1.5 text-[12.5px]",
                          "hover:bg-[var(--canvas-2)]",
                        )}
                      >
                        <span className="w-[26px] shrink-0 font-medium tabular-nums text-[var(--muted-ink)]">
                          {fillTemplate(labels.opportunity.ordinalTemplate, { n: row.seq })}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium text-[var(--ink)]">
                          {row.kindLabel || labels.opportunity.kindNone}
                          {row.title ? ` · ${row.title}` : ""}
                        </span>
                        <LeadStageChip
                          label={row.view.stageLabel}
                          tone={row.view.tone}
                          auto={row.view.auto}
                          autoTitle={labels.autoStageDetail}
                        />
                        {row.view.priority ? (
                          <LeadPriorityChip
                            label={row.view.priority.label}
                            tone={row.view.priority.tone}
                          />
                        ) : null}
                        <span className="flex shrink-0 items-center gap-1.5 text-[var(--muted-ink)]">
                          <LeadAvatar
                            label={row.view.ownerEmail ? row.view.ownerLabel : null}
                            seed={row.view.ownerEmail ?? undefined}
                            emptyLabel={labels.unassigned}
                          />
                          <span className="tabular-nums">{row.view.lastActivityRelative}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

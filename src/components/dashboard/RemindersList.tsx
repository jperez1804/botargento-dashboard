// Seguimiento › Recordatorios: open "volver a contactar" reminders, overdue
// first, then the ones due inside the warning window. Each row opens the
// conversation where the reminder can be closed. role="list" on divs keeps
// this out of the priority queue's `ul li` selectors.

import Link from "next/link";
import { BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrmLabels } from "@/config/verticals/_types";
import type { LeadView } from "@/lib/crm/view-model";

export type ReminderRow = { waId: string; displayName: string; view: LeadView };

type Props = { rows: ReadonlyArray<ReminderRow>; labels: CrmLabels; title: string };

export function RemindersList({ rows, labels, title }: Props) {
  if (rows.length === 0) return null;
  return (
    <section id="recordatorios" aria-label={title} className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)]">{title}</p>
      <div
        role="list"
        data-testid="reminders-list"
        className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] divide-y divide-[var(--rule)]"
      >
        {rows.map(({ waId, displayName, view }) => {
          const rem = view.reminder;
          if (!rem) return null;
          const overdue = rem.status === "overdue";
          return (
            <Link
              key={waId}
              role="listitem"
              href={`/conversations/${encodeURIComponent(waId)}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-[13.5px] hover:bg-[var(--canvas-2)] transition-colors focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-[-2px]"
            >
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 tabular-nums text-[12.5px] font-medium min-w-[150px]",
                  overdue ? "text-[var(--danger)]" : "text-[var(--muted-ink)]",
                )}
              >
                <BellRing className="size-3.5" aria-hidden />
                {rem.text}
              </span>
              <span className="font-medium text-[var(--ink)]">{displayName}</span>
              {rem.note ? <span className="text-[var(--muted-ink)] truncate min-w-0 flex-1">{rem.note}</span> : null}
              <span className="text-[12px] text-[var(--soft-ink)]">{view.ownerEmail ? view.ownerLabel : labels.unassigned}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

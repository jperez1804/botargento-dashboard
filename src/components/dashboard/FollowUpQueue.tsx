// Server component — pure data → markup, no interactivity needed.
// Used in two places: full list at /follow-up, top-5 preview on the overview.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/date";
import { formatAutomationLabel } from "@/lib/automation-labels";
import type { FollowUpQueueRow } from "@/db/views";

type Props = {
  rows: ReadonlyArray<FollowUpQueueRow>;
  locale: string;
  timezone: string;
  emptyText?: string;
};

const PRIORITY_STYLES: Record<
  FollowUpQueueRow["priority"],
  { bg: string; fg: string; label: string }
> = {
  high: { bg: "#F4CCCC", fg: "#8A1A1A", label: "Alta" },
  medium: { bg: "#FCE5CD", fg: "#8A4B00", label: "Media" },
  low: { bg: "#E6F4EA", fg: "#1B5E20", label: "Baja" },
};

export function FollowUpQueue({
  rows,
  locale,
  timezone,
  emptyText = "No hay contactos pendientes de seguimiento.",
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-[var(--rule)] bg-[var(--surface)] p-6 text-sm text-[var(--muted-ink)]">
        {emptyText}
      </div>
    );
  }
  return (
    <ul className="rounded-md border border-[var(--rule)] bg-[var(--surface)] divide-y divide-[var(--rule)] overflow-hidden">
      {rows.map((row) => {
        const style = PRIORITY_STYLES[row.priority];
        const reason = formatAutomationLabel(row.reason);
        return (
          <li
            key={row.contact_wa_id}
            className="group/row relative px-4 py-3 hover:bg-[var(--canvas)] transition-colors before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-[var(--client-primary)] before:opacity-0 hover:before:opacity-100 before:transition-opacity"
          >
            <Link
              href={`/conversations/${row.contact_wa_id}`}
              className="flex items-center gap-3 min-w-0"
            >
              <span
                className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide"
                style={{ background: style.bg, color: style.fg }}
              >
                {style.label}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--ink)] truncate">
                  {row.display_name ?? row.contact_wa_id}
                </div>
                <div className="text-xs text-[var(--muted-ink)] truncate">{reason ?? "—"}</div>
              </div>
              <div
                className={cn(
                  "shrink-0 hidden sm:block text-xs text-[var(--soft-ink)] tabular-nums",
                )}
              >
                {formatDateTime(row.last_seen, locale, timezone)}
              </div>
              <ChevronRight className="shrink-0 size-4 text-[var(--soft-ink)]" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

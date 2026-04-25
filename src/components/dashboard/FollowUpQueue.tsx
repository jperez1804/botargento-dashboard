// Server component — pure data → markup, no interactivity needed.
// Used in two places: full list at /follow-up, top-5 preview on the overview.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/date";
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
      <div className="rounded-md border border-[#e5e7eb] bg-white p-6 text-sm text-[#6b7280]">
        {emptyText}
      </div>
    );
  }
  return (
    <ul className="rounded-md border border-[#e5e7eb] bg-white divide-y divide-[#e5e7eb] overflow-hidden">
      {rows.map((row) => {
        const style = PRIORITY_STYLES[row.priority];
        return (
          <li key={row.contact_wa_id} className="px-4 py-3 hover:bg-[#fafafa]">
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
                <div className="text-sm font-medium text-[#111827] truncate">
                  {row.display_name ?? row.contact_wa_id}
                </div>
                <div className="text-xs text-[#6b7280] truncate">{row.reason ?? "—"}</div>
              </div>
              <div
                className={cn(
                  "shrink-0 hidden sm:block text-xs text-[#9ca3af] tabular-nums",
                )}
              >
                {formatDateTime(row.last_seen, locale, timezone)}
              </div>
              <ChevronRight className="shrink-0 size-4 text-[#9ca3af]" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

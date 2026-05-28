// Server component — pure data -> markup, no interactivity needed.
// Used in two places: full list at /follow-up, top-5 preview on the overview.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ListTodo } from "lucide-react";
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

// Priority -> semantic tone. Tone-to-priority mapping is constant across
// tenants; tenants can override the LABEL (Alta/Media/Baja vs Crítico/
// Importante/Normal etc.) via tenant config in a later PR — for now the
// labels stay literal.
const PRIORITY_TONES: Record<
  FollowUpQueueRow["priority"],
  { chip: string; label: string }
> = {
  high: {
    chip: "bg-[var(--danger-soft)] text-[var(--danger)]",
    label: "Alta",
  },
  medium: {
    chip: "bg-[var(--warning-soft)] text-[var(--warning)]",
    label: "Media",
  },
  low: {
    chip: "bg-[var(--positive-soft)] text-[var(--positive)]",
    label: "Baja",
  },
};

export function FollowUpQueue({
  rows,
  locale,
  timezone,
  emptyText = "No hay contactos pendientes de seguimiento.",
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--rule-strong)] bg-[var(--surface)] py-10 px-6 flex flex-col items-center text-center gap-2.5">
        <div className="size-9 rounded-lg bg-[var(--canvas-2)] text-[var(--soft-ink)] flex items-center justify-center">
          <ListTodo className="size-[18px]" aria-hidden="true" />
        </div>
        <div className="text-sm font-semibold text-[var(--ink)]">
          Sin contactos pendientes
        </div>
        <div className="text-[12.5px] text-[var(--soft-ink)] max-w-[320px] leading-snug">
          {emptyText}
        </div>
      </div>
    );
  }
  return (
    <ul className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] divide-y divide-[var(--rule)] overflow-hidden">
      {rows.map((row) => {
        const tone = PRIORITY_TONES[row.priority];
        const reason = formatAutomationLabel(row.reason);
        return (
          <li
            key={row.contact_wa_id}
            // Whole row is a link; the brand-color rail fades in on hover
            // as the "you can click this" affordance. The priority pill,
            // anchored left, is the persistent signal.
            className="group/row relative hover:bg-[var(--canvas-2)] transition-colors before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:bg-[var(--client-primary)] before:rounded-r-sm before:opacity-0 hover:before:opacity-100 before:transition-opacity focus-within:before:opacity-100"
          >
            <Link
              href={`/conversations/${row.contact_wa_id}`}
              className="flex items-center gap-4 min-w-0 px-5 py-4 focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-[-2px]"
              aria-label={`Abrir conversación con ${row.display_name ?? row.contact_wa_id} (prioridad ${tone.label.toLowerCase()})`}
            >
              {/* Priority pill — fixed 64 px wide, centered. Dot prefix
                * lets the pill scan from peripheral vision before the
                * text is read. */}
              <span
                className={cn(
                  "shrink-0 inline-flex items-center justify-center gap-1.5 min-w-[64px] h-[22px] px-2 rounded-full text-[11px] font-semibold uppercase tracking-[0.04em]",
                  tone.chip,
                )}
              >
                <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                {tone.label}
              </span>

              {/* Identity column: contact name (14.5 / 600) + reason code
                * (12.5 / mono / soft-ink) stacked. Reason code uses mono
                * because it's an automation flow identifier, not prose. */}
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-semibold tracking-[-0.005em] text-[var(--ink)] truncate">
                  {row.display_name ?? row.contact_wa_id}
                </div>
                <div className="text-[12.5px] text-[var(--soft-ink)] truncate font-[var(--font-geist-mono)]">
                  {reason ?? "—"}
                </div>
              </div>

              <div className="shrink-0 hidden sm:block text-[12.5px] text-[var(--muted-ink)] tabular-nums">
                {formatDateTime(row.last_seen, locale, timezone)}
              </div>
              <ChevronRight
                className="shrink-0 size-[14px] text-[var(--soft-ink)] group-hover/row:text-[var(--ink)] transition-colors"
                aria-hidden="true"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

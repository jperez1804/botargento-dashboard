import { formatNumber } from "@/lib/format";
import { formatAutomationLabel } from "@/lib/automation-labels";
import type { HandoffSummaryRow } from "@/lib/queries/handoffs";
import type { HandoffTargetDef } from "@/config/verticals/_types";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  rows: ReadonlyArray<HandoffSummaryRow>;
  targets: ReadonlyArray<HandoffTargetDef>;
  locale: string;
};

const MAX_CELLS = 8; // 4 columns × 2 rows

function friendlyName(target: string, defs: ReadonlyArray<HandoffTargetDef>): string {
  const lower = target.toLowerCase();
  const hit = defs.find((d) => lower.includes(d.match.toLowerCase()));
  return hit?.label ?? formatAutomationLabel(target) ?? target;
}

// Per-cell border helper. We can't use Tailwind's `divide-*` utilities here
// because the responsive col count changes (2 / 4), and `divide-*` doesn't
// understand grid row boundaries. Compute the borders explicitly: a cell
// gets a left border iff it's not in the first column for the current
// breakpoint, and a top border iff it's not in the first row.
function cellBorders(i: number): string {
  return cn(
    "border-[var(--rule)]",
    // Mobile · 2 cols
    i % 2 !== 0 && "border-l",
    Math.floor(i / 2) > 0 && "border-t",
    // Desktop · 4 cols — reset, then re-derive
    "md:border-l-0",
    i % 4 !== 0 && "md:border-l",
    "md:border-t-0",
    Math.floor(i / 4) > 0 && "md:border-t",
  );
}

// Compact destination strip. Replaces the previous 4-column row of full
// cards. Same data, ~1/4 the vertical space, table visible above the fold.
// Cells are display-only in this PR — clicking-to-filter the table below
// is a follow-up once `listBusinessHandoffs` supports a target filter.
export function HandoffSummaryCards({ rows, targets, locale }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<ArrowLeftRight className="size-[18px]" />}
        title="Todavía no hay derivaciones"
        body="Cuando el bot derive un contacto al equipo humano, aparecerá en este listado."
      />
    );
  }

  const visible = rows.slice(0, MAX_CELLS);

  return (
    <div className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] overflow-hidden">
      <div className="grid grid-cols-2 md:grid-cols-4">
        {visible.map((row, i) => {
          const isZero = row.count_24h === 0;
          return (
            <div
              key={row.target}
              className={cn(
                "px-4 py-3.5 flex flex-col gap-1.5 min-w-0",
                cellBorders(i),
              )}
            >
              <div className="text-[12px] text-[var(--soft-ink)] truncate">
                {friendlyName(row.target, targets)}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    "text-[22px] font-semibold tabular-nums tracking-[-0.02em] leading-[1.1]",
                    isZero ? "text-[var(--faint-ink)]" : "text-[var(--ink)]",
                  )}
                >
                  {formatNumber(row.count_24h, locale)}
                </span>
                <span className="text-[11.5px] text-[var(--soft-ink)] tabular-nums">
                  de {formatNumber(row.count_all_time, locale)} totales
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

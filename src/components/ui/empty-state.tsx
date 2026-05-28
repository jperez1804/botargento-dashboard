import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** Optional decorative icon (Lucide). Rendered in a soft canvas-2 square. */
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  /** Optional action button (or any inline element) shown below the body. */
  action?: ReactNode;
  className?: string;
};

// Shared empty-state primitive. Use anywhere a card / list / table has
// nothing to show — and distinguish "no results for these filters" from
// "no data ever exists" with different copy + different action.
//
// Visual contract:
// - 1 px dashed rule-strong border + surface bg + 12 px radius.
// - Optional 36 px canvas-2 square holding a 18 px icon (Lucide).
// - 14 px / 600 / ink title.
// - 12.5 px / soft-ink body, max-w ~360 px.
// - Action sits 8 px below the body.
//
// Inline action examples:
//   <EmptyState ... action={<Button variant="outline" size="sm">Limpiar filtros</Button>} />
export function EmptyState({ icon, title, body, action, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-[var(--rule-strong)] bg-[var(--surface)] py-10 px-6 flex flex-col items-center text-center gap-2.5",
        className,
      )}
    >
      {icon ? (
        <div className="size-9 rounded-lg bg-[var(--canvas-2)] text-[var(--soft-ink)] flex items-center justify-center mb-1">
          {icon}
        </div>
      ) : null}
      <div className="text-sm font-semibold text-[var(--ink)]">{title}</div>
      {body ? (
        <div className="text-[12.5px] text-[var(--soft-ink)] max-w-[360px] leading-snug">
          {body}
        </div>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

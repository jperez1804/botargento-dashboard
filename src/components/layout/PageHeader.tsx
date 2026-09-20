// The masthead every page shares: kicker, title, and the subtitle/counts
// stacked UNDER the title, all flush left. Actions (exports, toggles, row
// actions) keep the right edge of the title row.
//
// Before this component each page rendered its own header and pushed the
// subtitle to the far right of the title row, which read as two disconnected
// columns on wide screens.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** Small uppercase label above the title, or a node (e.g. a back link). */
  kicker?: ReactNode;
  title: ReactNode;
  /** Subtitle, counts or chips — rendered left, under the title. */
  meta?: ReactNode;
  /** Right-aligned controls on the title row. */
  actions?: ReactNode;
  /** Extra rows under the title block (tabs, scope notes). */
  children?: ReactNode;
  /** The hairline under the header; turn it off when the page draws its own. */
  divider?: boolean;
  /** Page-load reveal delay, for pages that stagger their sections. */
  revealDelay?: string;
  className?: string;
};

const KICKER_CLASS =
  "font-[var(--font-geist-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)]";

export function PageHeader({
  kicker,
  title,
  meta,
  actions,
  children,
  divider = true,
  revealDelay,
  className,
}: Props) {
  return (
    <header
      {...(revealDelay
        ? { "data-reveal": true, style: { ["--reveal-delay" as string]: revealDelay } }
        : {})}
      className={cn(
        "space-y-3",
        divider && "border-b border-[var(--rule)] pb-5",
        className,
      )}
    >
      {typeof kicker === "string" ? <p className={KICKER_CLASS}>{kicker}</p> : kicker}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-[var(--ink)]">
            {title}
          </h1>
          {meta ? <div className="text-[13px] text-[var(--muted-ink)]">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
      </div>

      {children}
    </header>
  );
}

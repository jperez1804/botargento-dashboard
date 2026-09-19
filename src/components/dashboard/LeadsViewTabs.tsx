// View switcher for /leads, rendered as a tab bar (Jira-style: underlined
// active tab under the masthead). Plain links over URL state — no client JS —
// so adding a future view is one more entry in the array the page builds.

import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { LayoutList, SquareKanban } from "lucide-react";
import { cn } from "@/lib/utils";

export type LeadsViewTabKey = "board" | "list";

const ICONS: Record<LeadsViewTabKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  board: SquareKanban,
  list: LayoutList,
};

type Props = {
  label: string;
  tabs: ReadonlyArray<{ key: LeadsViewTabKey; label: string; href: string; active: boolean }>;
};

export function LeadsViewTabs({ label, tabs }: Props) {
  return (
    <nav
      aria-label={label}
      data-testid="leads-view-tabs"
      className="flex items-center gap-1 border-b border-[var(--rule)]"
    >
      {tabs.map((tab) => {
        const Icon = ICONS[tab.key];
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13.5px] transition-colors",
              "focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-[-2px]",
              tab.active
                ? "border-[var(--client-primary)] font-semibold text-[var(--ink)]"
                : "border-transparent text-[var(--muted-ink)] hover:border-[var(--rule-strong)] hover:text-[var(--ink)]",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

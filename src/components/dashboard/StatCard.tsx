// A plain stat for the Resumen tab: icon, big number, one caption. Not
// KpiCard — that one compares against a previous period, which a fixed
// 7-day window has nothing to say about.

import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  caption?: string;
  icon?: ReactNode;
  tone?: "neutral" | "danger";
  href?: string;
  testId?: string;
};

export function StatCard({ label, value, caption, icon, tone = "neutral", href, testId }: Props) {
  const body = (
    <CardContent className="flex items-center gap-3.5 px-5 py-4">
      {icon ? (
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--canvas-2)] text-[var(--muted-ink)]"
          aria-hidden
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="flex items-baseline gap-2">
          <span className="text-[24px] font-semibold leading-none tabular-nums text-[var(--ink)]">{value}</span>
          <span className="text-[13.5px] font-medium text-[var(--ink)]">{label}</span>
        </p>
        {caption ? (
          <p
            className={cn(
              "mt-1 text-[12px]",
              tone === "danger" ? "font-medium text-[var(--danger)]" : "text-[var(--soft-ink)]",
            )}
          >
            {caption}
          </p>
        ) : null}
      </div>
    </CardContent>
  );
  return (
    <Card
      data-testid={testId}
      className={cn(href && "transition-shadow hover:shadow-sm")}
    >
      {href ? (
        <Link
          href={href}
          className="block rounded-[inherit] focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)]"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}

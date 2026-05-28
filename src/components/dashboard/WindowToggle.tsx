"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import type { WindowConfig, WindowDays } from "@/config/verticals/_types";

type Props = {
  value: WindowDays;
  config: WindowConfig;
};

export function WindowToggle({ value, config }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setWindow(next: WindowDays) {
    if (next === value) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === 7) params.delete("window");
    else params.set("window", String(next));
    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 text-xs">
      {/* Kicker label — matches the Caption treatment used elsewhere
       * (11 px / 500 / uppercase / 0.08em / soft-ink). Pairs the control
       * with its semantic meaning without using a real <label>. */}
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)]">
        {config.controlLabel}
      </span>
      <div
        role="radiogroup"
        aria-label={config.controlLabel}
        className="inline-flex h-8 rounded-lg border border-[var(--rule)] bg-[var(--canvas-2)] p-0.5"
      >
        {config.options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={isPending}
              onClick={() => setWindow(opt.value)}
              className={cn(
                // Pill — subtle raise on active. ink-text + surface-bg +
                // 1px rule ring. Inactive options use muted-ink + hover to
                // ink. Avoid the heavy "ink button" treatment that made
                // the active option look like a primary CTA.
                "px-2.5 h-7 rounded-md transition-colors text-[13px]",
                "focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-2",
                active
                  ? "bg-[var(--surface)] text-[var(--ink)] font-semibold ring-1 ring-[var(--rule)] shadow-[0_1px_0_rgba(0,0,0,0.03)]"
                  : "text-[var(--muted-ink)] font-medium hover:text-[var(--ink)]",
                isPending && "opacity-60",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--muted-ink)] font-[var(--font-geist-mono)]">
        {config.controlLabel}
      </span>
      <div
        role="radiogroup"
        aria-label={config.controlLabel}
        className="inline-flex rounded-md border border-[var(--rule)] bg-[var(--surface)] p-0.5"
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
                "rounded px-2 py-1 transition-colors",
                active
                  ? "bg-[var(--ink)] text-[var(--surface)] font-medium"
                  : "text-[var(--ink)] hover:bg-[var(--canvas)]",
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

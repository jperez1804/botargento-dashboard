"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import type { IntentTouchMode } from "@/lib/queries/intents";

type Props = {
  value: IntentTouchMode;
};

const OPTIONS: ReadonlyArray<{ value: IntentTouchMode; label: string }> = [
  { value: "last", label: "Último contacto" },
  { value: "first", label: "Primer contacto" },
  { value: "any", label: "Cualquier intención" },
];

export function IntentTouchToggle({ value }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setTouch(next: IntentTouchMode) {
    if (next === value) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === "last") params.delete("touch"); // last is the default; keep URLs clean
    else params.set("touch", next);
    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-[#6b7280]">Atribución:</span>
      <div
        role="radiogroup"
        aria-label="Atribución de intención"
        className="inline-flex rounded-md border border-[#e5e7eb] bg-white p-0.5"
      >
        {OPTIONS.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={isPending}
              onClick={() => setTouch(opt.value)}
              className={cn(
                "rounded px-2 py-1 transition-colors",
                active
                  ? "bg-[#111827] text-white"
                  : "text-[#374151] hover:bg-[#f3f4f6]",
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

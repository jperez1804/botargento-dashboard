"use client";

import { Info } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import type { AttributionConfig, AttributionMode } from "@/config/verticals/_types";

type Props = {
  value: AttributionMode;
  attribution: AttributionConfig;
};

export function IntentTouchToggle({ value, attribution }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const primary = attribution.options.filter((o) => !o.advanced);
  const advanced = attribution.options.filter((o) => o.advanced);
  const isAdvancedSelected = advanced.some((o) => o.value === value);

  // Disclosure: collapsed by default, but always rendered open when the URL
  // already targets an advanced mode (so a shared link doesn't hide its own
  // active chip). The user toggle only adds to "open" — it can't collapse a
  // currently-selected advanced mode.
  const [userExpanded, setUserExpanded] = useState(false);
  const advancedOpen = userExpanded || isAdvancedSelected;

  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipId = useId();
  const tooltipBtnRef = useRef<HTMLButtonElement | null>(null);

  // Esc dismisses the tooltip and returns focus to the trigger — keyboard
  // reachability per the tooltip-keyboard a11y rule.
  useEffect(() => {
    if (!tooltipOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTooltipOpen(false);
        tooltipBtnRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tooltipOpen]);

  function setTouch(next: AttributionMode) {
    if (next === value) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === "last") params.delete("touch");
    else params.set("touch", next);
    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  }

  const activeAny = value === "any";

  return (
    <div className="flex flex-col items-start gap-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[var(--muted-ink)]">{attribution.controlLabel}:</span>
        <div
          role="radiogroup"
          aria-label={attribution.controlLabel}
          className="inline-flex rounded-md border border-[var(--rule)] bg-[var(--surface)] p-0.5"
        >
          {primary.map((opt) => (
            <ToggleChip
              key={opt.value}
              active={opt.value === value}
              disabled={isPending}
              label={opt.label}
              onClick={() => setTouch(opt.value)}
            />
          ))}
          {advancedOpen
            ? advanced.map((opt) => (
                <ToggleChip
                  key={opt.value}
                  active={opt.value === value}
                  disabled={isPending}
                  label={opt.label}
                  onClick={() => setTouch(opt.value)}
                />
              ))
            : null}
        </div>
        <button
          type="button"
          aria-expanded={advancedOpen}
          onClick={() => setUserExpanded((u) => !u)}
          className="text-[var(--muted-ink)] hover:text-[var(--ink)] underline-offset-2 hover:underline"
        >
          {attribution.advancedToggleLabel} {advancedOpen ? "▴" : "▾"}
        </button>
        <button
          ref={tooltipBtnRef}
          type="button"
          aria-label={attribution.controlTooltip}
          aria-describedby={tooltipOpen ? tooltipId : undefined}
          aria-expanded={tooltipOpen}
          onClick={() => setTooltipOpen((o) => !o)}
          onBlur={() => setTooltipOpen(false)}
          className="inline-flex items-center justify-center rounded-full p-1 text-[var(--muted-ink)] hover:text-[var(--ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--client-primary)]"
        >
          <Info className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      {tooltipOpen ? (
        <div
          id={tooltipId}
          role="tooltip"
          className="max-w-md rounded-md border border-[var(--rule)] bg-[var(--surface)] px-3 py-2 text-[11px] text-[var(--ink)] leading-snug"
        >
          {attribution.controlTooltip}
        </div>
      ) : null}

      <p className="max-w-2xl text-[11px] leading-snug text-[var(--soft-ink)]">
        {attribution.scopeNote}
      </p>

      {activeAny ? (
        <p
          role="status"
          aria-live="polite"
          className="max-w-2xl rounded-md bg-[#FCE5CD] px-2 py-1 text-[11px] text-[#8A4B00]"
        >
          {attribution.anyModeWarning}
        </p>
      ) : null}
    </div>
  );
}

function ToggleChip({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded px-2 py-1 transition-colors",
        active
          ? "bg-[var(--ink)] text-[var(--surface)] font-medium"
          : "text-[var(--ink)] hover:bg-[var(--canvas)]",
        disabled && "opacity-60",
      )}
    >
      {label}
    </button>
  );
}

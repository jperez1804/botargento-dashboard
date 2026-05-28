"use client";

import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  title?: ReactNode;
  body?: ReactNode;
  /** Show a "Reintentar" button that calls this on click. */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

// Shared error-state primitive. For recoverable, retry-able failures —
// network, upstream timeout, transient 500s. Lives inside the failing
// component (table area, chart card, etc.) so the rest of the page chrome
// keeps working.
//
// Visual contract:
// - danger-soft bg + 30% danger border + 12 px radius.
// - 32 px surface circle holding the warning icon in --danger.
// - 14 px / 600 / ink title; 12.5 px / muted-ink body.
// - Optional retry button — outline variant, sm.
//
// For "session expired" / auth-lapse situations, prefer a warning-toned
// variant — that's a different mental model (signed-out, not broken).
export function ErrorState({
  title = "No pudimos cargar los datos",
  body = "Reintentá en unos segundos. Si persiste, contactá al equipo técnico.",
  onRetry,
  retryLabel = "Reintentar",
  className,
}: Props) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[color-mix(in_oklch,var(--danger)_30%,var(--rule))] bg-[var(--danger-soft)] py-10 px-6 flex flex-col items-center text-center gap-2.5",
        className,
      )}
    >
      <div className="size-8 rounded-full bg-[var(--surface)] text-[var(--danger)] flex items-center justify-center mb-1">
        <AlertTriangle className="size-[18px]" aria-hidden="true" />
      </div>
      <div className="text-sm font-semibold text-[var(--ink)]">{title}</div>
      <div className="text-[12.5px] text-[var(--muted-ink)] max-w-[360px] leading-snug">
        {body}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          <RefreshCw className="size-3.5 mr-1.5" aria-hidden="true" />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

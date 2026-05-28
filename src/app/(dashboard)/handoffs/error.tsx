"use client";

// Next.js error boundary for /handoffs. Catches anything thrown in the
// page's data fetch or rendering. Renders the shared ErrorState in place
// of the table area; the rest of the chrome (sidebar, header) is provided
// by the layout above and stays visible.

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function HandoffsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log to the console for engineers. In production this will also be
  // picked up by whatever telemetry transport you've wired (Sentry,
  // logflare, etc.) since Next.js re-throws to the server logger.
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[handoffs] route error", error);
  }, [error]);

  return (
    <div className="space-y-6">
      <header className="space-y-3 border-b border-[var(--rule)] pb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)] font-[var(--font-geist-mono)]">
          Operación
        </p>
        <h1 className="text-[30px] leading-[1.1] tracking-[-0.025em] text-[var(--ink)] font-semibold">
          Derivaciones
        </h1>
      </header>

      <ErrorState
        title="No pudimos cargar las derivaciones"
        body="Reintentá en unos segundos. Si el problema persiste, contactá al equipo técnico."
        onRetry={reset}
      />
    </div>
  );
}

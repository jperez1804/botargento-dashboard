"use client";

// Next.js error boundary for /conversations/[waId]. Catches anything thrown
// in getContact / getConversation and renders the shared ErrorState. The
// global Header (sidebar + tenant badge) stays visible since it's a layout
// above this route.

import { useEffect } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";

export default function ConversationDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[conversations/[waId]] route error", error);
  }, [error]);

  return (
    <div className="space-y-6">
      <nav
        aria-label="Migas de pan"
        className="flex items-center gap-3 text-[13px]"
      >
        <Link
          href="/conversations"
          className="inline-flex items-center gap-1.5 text-[var(--muted-ink)] hover:text-[var(--ink)] hover:underline underline-offset-[3px]"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          Conversaciones
        </Link>
      </nav>

      <ErrorState
        title="No pudimos cargar la conversación"
        body="Reintentá en unos segundos. Si el problema persiste, contactá al equipo técnico."
        onRetry={reset}
      />
    </div>
  );
}

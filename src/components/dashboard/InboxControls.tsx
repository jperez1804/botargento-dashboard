"use client";

// Client half of the two-way inbox, split WhatsApp-style: InboxControlBar
// (mode + Tomar/Devolver toggle) renders ABOVE the thread as a chat header;
// InboxComposer renders BELOW it, sticky at the viewport bottom, next to the
// newest messages; ScrollToLatest keeps the view pinned to the latest entry.
// All writes go through /api/inbox/* (which delegates to the n8n webhook) —
// these components never touch the DB. v1 refresh model: router.refresh()
// after every action + a 30s background poll.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Hand, Send, Undo2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ERROR_LABELS: Record<string, string> = {
  "fuera de ventana (el contacto no escribio en las ultimas 24h)":
    "Ventana de 24h cerrada — el contacto no escribió en las últimas 24 horas.",
  "meta send failed": "Meta rechazó el envío. Probá de nuevo en unos segundos.",
  webhook_unreachable: "No se pudo contactar al motor (n8n). Reintentá.",
};

async function postInbox(
  path: string,
  body: Record<string, unknown>,
  setError: (v: string | null) => void,
): Promise<boolean> {
  setError(null);
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = ERROR_LABELS[data.error] ?? data.error;
    } catch {
      // keep the status fallback
    }
    setError(message);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Control bar — chat header: current mode + takeover toggle + bot warning.
// ---------------------------------------------------------------------------

type ControlBarProps = {
  waId: string;
  mode: "bot" | "human";
  takenBy: string;
};

export function InboxControlBar({ waId, mode, takenBy }: ControlBarProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isHuman = mode === "human";

  // Background poll so inbound replies appear without manual reloads (v1:
  // polling, not SSE). Lives here (single instance per page), not in the
  // composer, so it survives composer disabled states.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [router]);

  async function handleToggle() {
    setBusy(true);
    const action = isHuman ? "release" : "takeover";
    const ok = await postInbox(`/api/inbox/${action}`, { contactWaId: waId }, setError);
    if (ok) router.refresh();
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
          isHuman
            ? "border-[color-mix(in_oklch,var(--client-primary)_55%,var(--rule))] bg-[color-mix(in_oklch,var(--client-primary)_8%,var(--surface))]"
            : "border-[var(--rule)] bg-[var(--surface)]",
        )}
      >
        <div className="min-w-0 space-y-0.5">
          <div className="text-[13px] font-semibold text-[var(--ink)]">
            {isHuman ? "Conversación tomada" : "El bot atiende esta conversación"}
          </div>
          <div className="text-[12px] text-[var(--soft-ink)] truncate">
            {isHuman
              ? `En pausa para el bot · a cargo de ${takenBy || "un agente"}`
              : "Tomala para responder vos sin que el bot interfiera."}
          </div>
        </div>
        <Button
          type="button"
          variant={isHuman ? "outline" : "default"}
          size="sm"
          disabled={busy}
          onClick={handleToggle}
        >
          {isHuman ? (
            <>
              <Undo2 className="size-4" aria-hidden="true" />
              Devolver al bot
            </>
          ) : (
            <>
              <Hand className="size-4" aria-hidden="true" />
              Tomar conversación
            </>
          )}
        </Button>
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-red-300/60 bg-red-500/10 px-3 py-2 text-[12.5px] text-[var(--ink)]">
          {error}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composer — sticky at the viewport bottom, right under the newest messages.
// ---------------------------------------------------------------------------

type ComposerProps = {
  waId: string;
  mode: "bot" | "human";
  inWindow: boolean;
};

export function InboxComposer({ waId, mode, inWindow }: ComposerProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isHuman = mode === "human";

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    const ok = await postInbox("/api/inbox/send", { contactWaId: waId, text: trimmed }, setError);
    if (ok) {
      setText("");
      router.refresh();
      textareaRef.current?.focus();
    }
    setBusy(false);
  }

  return (
    <div className="sticky bottom-0 -mx-1 px-1 pb-2 pt-3 bg-[var(--canvas)]">
      <div className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] p-3 space-y-2 shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.25)]">
        {/* Bot-active warning while composing without takeover — signaling
         * only, the manual choice is honored (no auto-takeover). */}
        {!isHuman ? (
          <div className="flex items-start gap-2 text-[12px] text-[var(--muted-ink)]">
            <TriangleAlert className="size-3.5 shrink-0 mt-0.5 text-amber-500" aria-hidden="true" />
            <span>El bot sigue activo: si enviás sin tomar la conversación, puede responder en paralelo.</span>
          </div>
        ) : null}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!inWindow || busy}
          rows={2}
          maxLength={4000}
          placeholder={
            inWindow
              ? "Escribí tu respuesta…"
              : "Ventana de 24h cerrada — el contacto tiene que escribir de nuevo para poder responderle."
          }
          className={cn(
            "w-full resize-y rounded-lg border border-[var(--rule)] bg-[var(--canvas-2)] px-3 py-2",
            "text-[13.5px] leading-snug text-[var(--ink)] placeholder:text-[var(--soft-ink)]",
            "focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)]",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          )}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11.5px] text-[var(--soft-ink)]">
            {inWindow ? "Ctrl+Enter para enviar" : "Reapertura con plantilla: no disponible en v1."}
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!inWindow || busy || !text.trim()}
            onClick={handleSend}
          >
            <Send className="size-4" aria-hidden="true" />
            {busy ? "Enviando…" : "Enviar"}
          </Button>
        </div>
        {error ? (
          <div role="alert" className="rounded-lg border border-red-300/60 bg-red-500/10 px-3 py-2 text-[12.5px] text-[var(--ink)]">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scroll pin — jumps to the newest message on load and whenever the entry
// count changes (send, poll refresh). Instant on first paint, smooth after.
// ---------------------------------------------------------------------------

export function ScrollToLatest({ entriesCount }: { entriesCount: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    ref.current?.scrollIntoView({
      behavior: firstRender.current ? "instant" : "smooth",
      block: "end",
    });
    firstRender.current = false;
  }, [entriesCount]);

  return <div ref={ref} aria-hidden="true" />;
}

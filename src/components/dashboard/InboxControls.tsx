"use client";

// Client half of the two-way inbox: the Tomar/Devolver toggle + the reply
// composer. All writes go through /api/inbox/* (which delegates to the n8n
// webhook) — this component never touches the DB. v1 refresh model: explicit
// router.refresh() after every action + a 30s background poll.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Hand, Send, Undo2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  waId: string;
  mode: "bot" | "human";
  takenBy: string;
  inWindow: boolean;
};

type Busy = "none" | "toggle" | "send";

const ERROR_LABELS: Record<string, string> = {
  "fuera de ventana (el contacto no escribio en las ultimas 24h)":
    "Ventana de 24h cerrada — el contacto no escribió en las últimas 24 horas.",
  "meta send failed": "Meta rechazó el envío. Probá de nuevo en unos segundos.",
  webhook_unreachable: "No se pudo contactar al motor (n8n). Reintentá.",
};

export function InboxControls({ waId, mode, takenBy, inWindow }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<Busy>("none");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isHuman = mode === "human";

  // Background poll so inbound replies appear without manual reloads (v1:
  // polling, not SSE). 30s keeps the tenant DB load negligible.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [router]);

  async function post(path: string, body: Record<string, unknown>): Promise<boolean> {
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

  async function handleToggle() {
    setBusy("toggle");
    setNotice(null);
    const action = isHuman ? "release" : "takeover";
    const ok = await post(`/api/inbox/${action}`, { contactWaId: waId });
    if (ok) {
      setNotice(
        action === "takeover"
          ? "Conversación tomada — el bot está en pausa para este contacto."
          : "Conversación devuelta — el bot volvió a atender.",
      );
      router.refresh();
    }
    setBusy("none");
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy("send");
    setNotice(null);
    const ok = await post("/api/inbox/send", { contactWaId: waId, text: trimmed });
    if (ok) {
      setText("");
      router.refresh();
      textareaRef.current?.focus();
    }
    setBusy("none");
  }

  return (
    <div className="space-y-3">
      {/* Control strip: current mode + toggle */}
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
          disabled={busy !== "none"}
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

      {/* Bot-active warning when composing without takeover — signaling only,
       * the manual choice is honored (no auto-takeover). */}
      {!isHuman ? (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--rule)] bg-[var(--canvas-2)] px-3 py-2 text-[12.5px] text-[var(--muted-ink)]">
          <TriangleAlert className="size-4 shrink-0 mt-0.5 text-amber-500" aria-hidden="true" />
          <span>
            El bot sigue activo en esta conversación: si enviás un mensaje sin tomarla,
            el bot puede responder en paralelo.
          </span>
        </div>
      ) : null}

      {/* Composer */}
      <div className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] p-3 space-y-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!inWindow || busy === "send"}
          rows={3}
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
            disabled={!inWindow || busy !== "none" || !text.trim()}
            onClick={handleSend}
          >
            <Send className="size-4" aria-hidden="true" />
            {busy === "send" ? "Enviando…" : "Enviar"}
          </Button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-red-300/60 bg-red-500/10 px-3 py-2 text-[12.5px] text-[var(--ink)]">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="rounded-lg border border-[var(--rule)] bg-[var(--canvas-2)] px-3 py-2 text-[12.5px] text-[var(--muted-ink)]">
          {notice}
        </div>
      ) : null}
    </div>
  );
}

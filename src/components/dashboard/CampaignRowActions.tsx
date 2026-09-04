"use client";

// Row-level campaign controls: pause/resume/finish with an inline two-click
// confirmation (no dialog primitive is wired in this repo yet), plus a popover
// editor for the daily cap. Writes go through /api/campaigns/* which delegates
// to the n8n campaign-actions webhook — the dashboard never writes outreach.*.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ERROR_LABELS: Record<string, string> = {
  not_found: "Acciones no disponibles en este tenant.",
  invalid_body: "Datos inválidos.",
  "campaign not found": "La campaña no existe.",
  campaigns_not_configured: "Falta configurar el webhook de campañas.",
  webhook_unreachable: "No se pudo contactar a n8n. Probá de nuevo.",
  webhook_failed: "n8n rechazó la acción.",
};

const errorLabel = (e: string | undefined) =>
  (e && ERROR_LABELS[e]) || "No se pudo completar la acción.";

async function postCampaign(
  path: "set-status" | "set-cap",
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/campaigns/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return { ok: res.ok && data.ok === true, error: data.error };
  } catch {
    return { ok: false, error: "webhook_unreachable" };
  }
}

type PendingAction = {
  status: "active" | "paused" | "done";
  confirmLabel: string;
  successLabel: string;
  destructive: boolean;
};

const ACTION_BY_KEY: Record<string, PendingAction> = {
  pause: {
    status: "paused",
    confirmLabel: "¿Pausar envíos?",
    successLabel: "Campaña pausada",
    destructive: false,
  },
  resume: {
    status: "active",
    confirmLabel: "¿Activar? Empieza a enviar",
    successLabel: "Campaña activada",
    destructive: false,
  },
  finish: {
    status: "done",
    confirmLabel: "¿Finalizar? No se reanuda",
    successLabel: "Campaña finalizada",
    destructive: true,
  },
};

type Props = {
  campaignId: number;
  status: string;
  /** Pending recipients — with 0 the runner has nothing to send, so pausing
   *  an active campaign is a no-op and the button is hidden. */
  pending?: number;
};

export function CampaignRowActions({ campaignId, status, pending }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-revert the confirmation pill after 4s of inaction.
  useEffect(() => {
    if (!confirming) return;
    confirmTimer.current = setTimeout(() => setConfirming(null), 4000);
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, [confirming]);

  async function runStatus(key: string) {
    const action = ACTION_BY_KEY[key];
    if (!action) return;
    setConfirming(null);
    setBusy(true);
    const res = await postCampaign("set-status", { campaignId, status: action.status });
    setBusy(false);
    if (res.ok) {
      toast.success(action.successLabel);
      router.refresh();
    } else {
      toast.error(errorLabel(res.error));
    }
  }

  const available: { key: string; label: string; icon: ReactNode }[] = [];
  const poolExhausted = pending !== undefined && pending === 0;
  if (status === "active" && !poolExhausted) {
    available.push({ key: "pause", label: "Pausar", icon: <Pause className="size-3.5" aria-hidden /> });
  }
  if (status === "paused" || status === "draft") {
    available.push({ key: "resume", label: "Activar", icon: <Play className="size-3.5" aria-hidden /> });
  }
  if (status === "active" || status === "paused") {
    available.push({
      key: "finish",
      label: "Finalizar",
      icon: <CheckCircle2 className="size-3.5" aria-hidden />,
    });
  }

  if (available.length === 0) return null;

  return (
    <div className="flex items-center justify-end gap-1" onKeyDown={(e) => {
      if (e.key === "Escape") setConfirming(null);
    }}>
      {busy ? (
        <Loader2 className="size-4 animate-spin text-[var(--soft-ink)]" aria-label="Aplicando…" />
      ) : confirming ? (
        <Button
          type="button"
          size="xs"
          variant={ACTION_BY_KEY[confirming]?.destructive ? "destructive" : "secondary"}
          onClick={() => runStatus(confirming)}
          onBlur={() => setConfirming(null)}
          autoFocus
        >
          {ACTION_BY_KEY[confirming]?.confirmLabel}
        </Button>
      ) : (
        available.map((a) => (
          <Button
            key={a.key}
            type="button"
            size="xs"
            variant="ghost"
            aria-label={a.label}
            title={a.label}
            onClick={() => setConfirming(a.key)}
            className="gap-1 text-[var(--muted-ink)] hover:text-[var(--ink)]"
          >
            {a.icon}
            <span className="hidden sm:inline">{a.label}</span>
          </Button>
        ))
      )}
    </div>
  );
}

export function CampaignCapEditor({ campaignId, dailyCap }: { campaignId: number; dailyCap: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(dailyCap));
  const [busy, setBusy] = useState(false);

  async function save() {
    const cap = Number(value);
    if (!Number.isInteger(cap) || cap < 1 || cap > 100) {
      toast.error("El cap debe ser un entero entre 1 y 100.");
      return;
    }
    setBusy(true);
    const res = await postCampaign("set-cap", { campaignId, dailyCap: cap });
    setBusy(false);
    if (res.ok) {
      toast.success(`Cap diario: ${cap}`);
      setOpen(false);
      router.refresh();
    } else {
      toast.error(errorLabel(res.error));
    }
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setValue(String(dailyCap)); }}>
      <PopoverTrigger
        className="cursor-pointer rounded px-1 underline decoration-dotted underline-offset-2 hover:bg-[var(--canvas-2)]"
        aria-label={`Editar cap diario (actual ${dailyCap})`}
        title="Editar cap diario"
      >
        {dailyCap}
      </PopoverTrigger>
      <PopoverContent className="w-52 space-y-2 p-3">
        <label
          htmlFor={`cap-${campaignId}`}
          className="block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)]"
        >
          Cap diario (1–100)
        </label>
        <div className="flex items-center gap-2">
          <input
            id={`cap-${campaignId}`}
            type="number"
            min={1}
            max={100}
            value={value}
            disabled={busy}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void save(); }}
            className="h-8 w-20 rounded-md border border-[var(--rule)] bg-[var(--surface)] px-2 text-[13px] tabular-nums text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)]"
          />
          <Button type="button" size="xs" onClick={() => void save()} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : "Guardar"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CampaignsPoller() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}

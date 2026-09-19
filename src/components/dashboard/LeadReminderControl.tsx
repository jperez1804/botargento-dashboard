"use client";

// "Volver a contactar el día X". Shows the open reminder (overdue in danger
// tone) with a "Hecho" action, and a small form to schedule a new one. The
// date input starts empty on purpose: pre-filling a datetime-local from an ISO
// date depends on the browser timezone and would mismatch the server render.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { errorText, postLead } from "@/lib/crm/api-client";
import { LEAD_CAPTION_CLASS, LEAD_FIELD_CLASS } from "@/components/dashboard/lead-field-class";
import type { CrmLabels } from "@/config/verticals/_types";
import type { LeadView } from "@/lib/crm/view-model";

type Props = {
  waId: string;
  reminder: LeadView["reminder"];
  canEdit: boolean;
  labels: CrmLabels;
};

export function LeadReminderControl({ waId, reminder, canEdit, labels }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");

  async function run(path: "reminder-set" | "reminder-done", body: Record<string, unknown>) {
    setBusy(true);
    const res = await postLead(path, { contactWaId: waId, ...body });
    setBusy(false);
    if (res.ok) {
      toast.success(labels.saved);
      setWhen("");
      setNote("");
      router.refresh();
    } else {
      toast.error(errorText(labels.errors, res.error));
    }
  }

  function schedule() {
    const at = new Date(when);
    if (!when || Number.isNaN(at.getTime())) {
      toast.error(labels.errors.invalid_body);
      return;
    }
    void run("reminder-set", { at: at.toISOString(), note: note.trim() });
  }

  const open = reminder && reminder.status !== "done" ? reminder : null;

  return (
    <div className="space-y-2.5">
      {open ? (
        <div
          data-testid="lead-reminder"
          className={cn(
            "flex items-start gap-2 rounded-md border px-2.5 py-2 text-[12.5px]",
            open.status === "overdue"
              ? "border-[color-mix(in_oklch,var(--danger)_35%,var(--rule))] bg-[var(--danger-soft)] text-[var(--danger)]"
              : "border-[var(--rule)] bg-[var(--canvas-2)] text-[var(--ink)]",
          )}
        >
          <BellRing className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium tabular-nums">{open.text}</p>
            {open.note ? <p className="text-[var(--muted-ink)] break-words">{open.note}</p> : null}
          </div>
          {canEdit ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={busy}
              onClick={() => void run("reminder-done", {})}
              className="shrink-0"
            >
              <Check className="size-3" aria-hidden />
              {labels.markDone}
            </Button>
          ) : null}
        </div>
      ) : null}

      {canEdit ? (
        <div className="space-y-1.5">
          <label htmlFor={`reminder-at-${waId}`} className={LEAD_CAPTION_CLASS}>
            {labels.whenLabel}
          </label>
          <input
            id={`reminder-at-${waId}`}
            type="datetime-local"
            value={when}
            disabled={busy}
            onChange={(e) => setWhen(e.target.value)}
            className={LEAD_FIELD_CLASS}
          />
          <input
            type="text"
            aria-label={labels.nextStepLabel}
            placeholder={labels.reminderNotePlaceholder}
            value={note}
            maxLength={300}
            disabled={busy}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") schedule();
            }}
            className={LEAD_FIELD_CLASS}
          />
          <div className="flex justify-end">
            <Button type="button" size="xs" disabled={busy || !when} onClick={schedule}>
              {busy ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
              {labels.setReminder}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

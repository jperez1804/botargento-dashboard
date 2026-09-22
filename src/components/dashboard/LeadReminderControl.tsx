"use client";

// "Volver a contactar el día X". Shows the open reminder (overdue in danger
// tone) with a "Hecho" action, and a small form to schedule a new one. The
// date input starts empty on purpose: pre-filling a datetime-local from an ISO
// date depends on the browser timezone and would mismatch the server render.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Check, Loader2, Pencil } from "lucide-react";
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
  // With an open reminder the form hides behind "Cambiar" so the callout is
  // what the eye lands on.
  const [editing, setEditing] = useState(false);

  async function run(path: "reminder-set" | "reminder-done", body: Record<string, unknown>) {
    setBusy(true);
    const res = await postLead(path, { contactWaId: waId, ...body });
    setBusy(false);
    if (res.ok) {
      toast.success(labels.saved);
      setWhen("");
      setNote("");
      setEditing(false);
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
  const showForm = canEdit && (!open || editing);

  return (
    <div className="space-y-2.5">
      {open ? (
        <div
          data-testid="lead-reminder"
          data-reminder-status={open.status}
          className={cn(
            "flex items-start gap-2 rounded-md border px-3 py-2.5 text-[12.5px]",
            open.status === "overdue"
              ? "border-[color-mix(in_oklch,var(--danger)_35%,var(--rule))] bg-[var(--danger-soft)] text-[var(--danger)]"
              : open.status === "upcoming"
                ? "border-[color-mix(in_oklch,var(--warning)_45%,var(--rule))] bg-[var(--warning-soft)] text-[color-mix(in_oklch,var(--warning)_65%,var(--ink))]"
                : "border-[var(--rule)] bg-[var(--canvas-2)] text-[var(--ink)]",
          )}
        >
          <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-[13px] font-semibold">{open.relativeText}</p>
            <p className="font-[var(--font-geist-mono)] text-[11.5px] tabular-nums opacity-80">{open.text}</p>
            {open.note ? (
              <p className="pt-0.5 text-[13px] leading-snug text-[var(--ink)] break-words">{open.note}</p>
            ) : null}
          </div>
          {canEdit ? (
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={busy}
                onClick={() => void run("reminder-done", {})}
              >
                <Check className="size-3" aria-hidden />
                {labels.markDone}
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={busy}
                aria-expanded={editing}
                onClick={() => setEditing((v) => !v)}
                className="text-[var(--muted-ink)]"
              >
                <Pencil className="size-3" aria-hidden />
                {labels.reminderChange}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {showForm ? (
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

"use client";

// The open reminder, shown above the Details list: relative headline
// ("Vence mañana" / "Vencido ayer"), exact date, note, and "Hecho" /
// "Cambiar" for editors. Tone follows urgency.

import { BellRing, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CrmLabels } from "@/config/verticals/_types";
import type { LeadView } from "@/lib/crm/view-model";

type Props = {
  reminder: NonNullable<LeadView["reminder"]>;
  canEdit: boolean;
  busy: boolean;
  labels: CrmLabels;
  onDone: () => void;
  onChange: () => void;
};

export function ReminderCallout({ reminder, canEdit, busy, labels, onDone, onChange }: Props) {
  return (
    <div
      data-testid="lead-reminder"
      data-reminder-status={reminder.status}
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2.5 text-[12.5px]",
        reminder.status === "overdue"
          ? "border-[color-mix(in_oklch,var(--danger)_35%,var(--rule))] bg-[var(--danger-soft)] text-[var(--danger)]"
          : reminder.status === "upcoming"
            ? "border-[color-mix(in_oklch,var(--warning)_45%,var(--rule))] bg-[var(--warning-soft)] text-[color-mix(in_oklch,var(--warning)_65%,var(--ink))]"
            : "border-[var(--rule)] bg-[var(--canvas-2)] text-[var(--ink)]",
      )}
    >
      <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[13px] font-semibold">{reminder.relativeText}</p>
        <p className="font-[var(--font-geist-mono)] text-[11.5px] tabular-nums opacity-80">{reminder.text}</p>
        {reminder.note ? (
          <p className="pt-0.5 text-[13px] leading-snug text-[var(--ink)] break-words">{reminder.note}</p>
        ) : null}
        {reminder.notifiedText ? (
          <p data-testid="reminder-notified" className="text-[11.5px] opacity-70">
            {reminder.notifiedText}
          </p>
        ) : null}
        {canEdit ? (
          <div className="flex justify-end gap-1 pt-1">
            <Button type="button" size="xs" variant="ghost" disabled={busy} onClick={onDone}>
              <Check className="size-3" aria-hidden />
              {labels.markDone}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={busy}
              onClick={onChange}
              className="text-[var(--muted-ink)]"
            >
              <Pencil className="size-3" aria-hidden />
              {labels.reminderChange}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

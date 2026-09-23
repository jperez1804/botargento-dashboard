"use client";

// The lead's "Details" list (Jira-style inline editing), rows ordered by what
// a person does first: Responsable (with Tomar) → Próximo paso → Etapa →
// Prioridad → Presupuesto. One row edits at a time. Selects save as soon as
// an option is chosen (keyboard: Enter after arrowing); text/number editors
// confirm with ✓ / Enter, cancel with ✗ / Esc, and a click outside commits
// when there is a valid change. "Tomar" saves at once and the toast offers
// Deshacer. Every write goes through /api/leads/* and then router.refresh().

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Hand } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { errorText, postLead, type LeadApiPath } from "@/lib/crm/api-client";
import { fillTemplate } from "@/lib/crm/view-model";
import { priorityOptions } from "@/lib/crm/priority";
import {
  combineDateTime,
  DEFAULT_REMINDER_TIME,
  presetDate,
  REMINDER_PRESETS,
  toDateInput,
  toTimeInput,
  type ReminderPreset,
} from "@/lib/crm/reminder-presets";
import { InlineConfirm, InlineField } from "@/components/dashboard/InlineField";
import { LeadAvatar } from "@/components/dashboard/LeadAvatar";
import { LeadPriorityChip } from "@/components/dashboard/LeadPriorityChip";
import { LeadStageChip } from "@/components/dashboard/LeadStageChip";
import { ReminderCallout } from "@/components/dashboard/ReminderCallout";
import { LEAD_FIELD_CLASS, TOGGLE_CHIP_CLASS } from "@/components/dashboard/lead-field-class";
import type { CrmLabels } from "@/config/verticals/_types";
import type { LeadView } from "@/lib/crm/view-model";

export type LeadDetailField = "stage" | "priority" | "budget" | "owner" | "reminder";

type Props = {
  waId: string;
  view: LeadView;
  labels: CrmLabels;
  stages: ReadonlyArray<{ key: string; label: string }>;
  lostKey: string;
  currencies: ReadonlyArray<string>;
  members: ReadonlyArray<{ email: string; label: string }>;
  sessionEmail: string;
  isAdmin: boolean;
  canEdit: boolean;
  // A row to open as soon as the card mounts (Nuevo lead → the next step).
  initialField?: LeadDetailField;
};

const SELECT_CLASS = cn(LEAD_FIELD_CLASS, "h-8");

/**
 * A native select that commits on a real choice: mouse pick → onChange
 * commits; arrow keys only move a pending value and Enter commits it.
 * Leaving the field (blur, Esc, click outside) never saves — arrowing down
 * to peek at the options must not change the lead.
 */
function CommitSelect({
  value,
  options,
  onCommit,
  ...rest
}: {
  value: string;
  options: ReadonlyArray<{ key: string; label: string }>;
  onCommit: (next: string) => void;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange">) {
  const [pending, setPending] = useState(value);
  const viaKeyboard = useRef(false);
  return (
    <select
      {...rest}
      value={pending}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") viaKeyboard.current = true;
        if (e.key === "Enter" && pending !== value) {
          e.preventDefault();
          onCommit(pending);
        }
      }}
      onChange={(e) => {
        setPending(e.target.value);
        if (!viaKeyboard.current) onCommit(e.target.value);
        viaKeyboard.current = false;
      }}
      className={SELECT_CLASS}
    >
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

type ReminderDraft = { preset: ReminderPreset | null; date: string; time: string; note: string };

// "Cambiar" starts from the open reminder as a custom date; a new one starts
// empty, on the preset chips.
function reminderDraft(open: LeadView["reminder"]): ReminderDraft {
  if (!open) return { preset: null, date: "", time: DEFAULT_REMINDER_TIME, note: "" };
  const at = new Date(open.atIso);
  return { preset: "custom", date: toDateInput(at), time: toTimeInput(at), note: open.note };
}

export function LeadDetails({
  waId,
  view,
  labels,
  stages,
  lostKey,
  currencies,
  members,
  sessionEmail,
  isAdmin,
  canEdit,
  initialField,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<LeadDetailField | null>(canEdit ? (initialField ?? null) : null);
  const [busy, setBusy] = useState(false);

  // Per-editor draft state.
  const [lostReason, setLostReason] = useState(labels.lostReasons[0] ?? "");
  const [pendingLost, setPendingLost] = useState(false);
  const manualBudget =
    view.budget?.source === "manual" && view.budget.amount !== null
      ? { amount: view.budget.amount, currency: view.budget.currency }
      : null;
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(currencies[0] ?? "");
  const openReminder = view.reminder && view.reminder.status !== "done" ? view.reminder : null;
  const [reminder, setReminder] = useState<ReminderDraft>(() =>
    reminderDraft(initialField === "reminder" ? openReminder : null),
  );
  const noteRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  function open(field: LeadDetailField) {
    setPendingLost(false);
    if (field === "budget") {
      setAmount(manualBudget ? String(manualBudget.amount) : "");
      setCurrency(manualBudget?.currency ?? currencies[0] ?? "");
    }
    if (field === "reminder") setReminder(reminderDraft(openReminder));
    setEditing(field);
  }
  const close = () => {
    setEditing(null);
    setPendingLost(false);
  };

  async function save(path: LeadApiPath, body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    const res = await postLead(path, { contactWaId: waId, ...body });
    setBusy(false);
    if (res.ok) {
      toast.success(labels.saved);
      close();
      router.refresh();
      return true;
    }
    toast.error(errorText(labels.errors, res.error));
    if (res.error === "already_owned") router.refresh();
    return false;
  }

  const editLabel = (field: string) => fillTemplate(labels.editFieldTemplate, { field });
  const confirmProps = { confirmLabel: labels.confirm, cancelLabel: labels.cancel, busy };

  // ── Responsable ──
  const canReassign = isAdmin || view.ownerEmail === null || view.ownerEmail === sessionEmail;
  const ownerEditor = (
    <>
      <label htmlFor={`owner-${waId}`} className="sr-only">
        {labels.ownerLabel}
      </label>
      <CommitSelect
        id={`owner-${waId}`}
        data-testid="lead-owner-select"
        autoFocus
        disabled={busy}
        value={view.ownerEmail ?? ""}
        options={[{ key: "", label: labels.unassigned }, ...members.map((m) => ({ key: m.email, label: m.label }))]}
        onCommit={(next) => {
          if (next === (view.ownerEmail ?? "")) return close();
          void save("assign", { ownerEmail: next || null });
        }}
      />
    </>
  );

  // "Tomar" saves at once; the toast offers to give the lead back.
  async function takeLead() {
    setBusy(true);
    const res = await postLead("assign", { contactWaId: waId, ownerEmail: "me", take: true });
    setBusy(false);
    router.refresh();
    if (!res.ok) {
      toast.error(errorText(labels.errors, res.error));
      return;
    }
    toast.success(labels.takenToast, {
      duration: 8000,
      action: {
        label: labels.undo,
        onClick: () => {
          void postLead("assign", { contactWaId: waId, ownerEmail: null }).then((undo) => {
            if (!undo.ok) toast.error(errorText(labels.errors, undo.error));
            router.refresh();
          });
        },
      },
    });
  }
  const takeAction =
    canEdit && view.ownerEmail === null ? (
      <Button
        type="button"
        size="xs"
        variant="outline"
        data-testid="lead-take"
        disabled={busy}
        onClick={() => void takeLead()}
        className="shrink-0"
      >
        <Hand className="size-3" aria-hidden />
        {labels.takeLead}
      </Button>
    ) : null;

  // ── Próximo paso ──
  const reminderAt = combineDateTime(reminder.date, reminder.time);
  const reminderChanged =
    !openReminder ||
    reminderAt?.toISOString() !== openReminder.atIso ||
    reminder.note.trim() !== openReminder.note;
  const canSaveReminder = reminderAt !== null && reminderChanged;
  const saveReminder = () => {
    if (!reminderAt) return;
    void save("reminder-set", { at: reminderAt.toISOString(), note: reminder.note.trim() });
  };
  function choosePreset(preset: ReminderPreset) {
    const date = presetDate(preset, new Date());
    setReminder((r) => ({ ...r, preset, date: date ?? r.date }));
    // The inputs mount on the next commit: a preset goes on to the note
    // ("when → what"), a custom date starts on the date field.
    requestAnimationFrame(() => (date ? noteRef : dateRef).current?.focus());
  }
  const reminderEditor = (
    <div className="space-y-1.5">
      <div role="group" aria-label={labels.whenLabel} className="flex flex-wrap gap-1">
        {REMINDER_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            data-testid={`reminder-preset-${p}`}
            aria-pressed={reminder.preset === p}
            disabled={busy}
            onClick={() => choosePreset(p)}
            className={TOGGLE_CHIP_CLASS}
          >
            {labels.reminderPresets[p]}
          </button>
        ))}
      </div>
      {reminder.preset ? (
        <>
          <input
            ref={noteRef}
            type="text"
            aria-label={labels.nextStepLabel}
            data-testid="reminder-note"
            placeholder={labels.reminderNotePlaceholder}
            value={reminder.note}
            maxLength={300}
            disabled={busy}
            onChange={(e) => setReminder((r) => ({ ...r, note: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveReminder();
              }
            }}
            className={LEAD_FIELD_CLASS}
          />
          <div className="flex items-center gap-1.5">
            <label htmlFor={`reminder-date-${waId}`} className="sr-only">
              {labels.dateLabel}
            </label>
            <input
              ref={dateRef}
              id={`reminder-date-${waId}`}
              type="date"
              data-testid="reminder-date"
              value={reminder.date}
              disabled={busy}
              onChange={(e) => setReminder((r) => ({ ...r, preset: "custom", date: e.target.value }))}
              className={cn(LEAD_FIELD_CLASS, "min-w-0 flex-1 tabular-nums")}
            />
            <label htmlFor={`reminder-time-${waId}`} className="sr-only">
              {labels.timeLabel}
            </label>
            <input
              id={`reminder-time-${waId}`}
              type="time"
              data-testid="reminder-time"
              value={reminder.time}
              disabled={busy}
              onChange={(e) => setReminder((r) => ({ ...r, time: e.target.value }))}
              className={cn(LEAD_FIELD_CLASS, "w-[96px] shrink-0 tabular-nums")}
            />
          </div>
          <div className="flex justify-end">
            <InlineConfirm
              {...confirmProps}
              confirmLabel={labels.setReminder}
              disabled={!canSaveReminder}
              onConfirm={saveReminder}
              onCancel={close}
            />
          </div>
        </>
      ) : null}
    </div>
  );

  // ── Etapa ──
  const stageEditor = (
    <div className="space-y-1.5">
      <label htmlFor={`stage-${waId}`} className="sr-only">
        {labels.stageLabel}
      </label>
      <CommitSelect
        id={`stage-${waId}`}
        data-testid="lead-stage-select"
        autoFocus
        disabled={busy}
        value={view.stageKey}
        options={stages}
        onCommit={(next) => {
          if (next === view.stageKey) return close();
          if (next === lostKey) return setPendingLost(true);
          void save("set-stage", { stage: next });
        }}
      />
      {pendingLost ? (
        <div className="space-y-1.5">
          <label htmlFor={`lost-reason-${waId}`} className="sr-only">
            {labels.lostReasonLabel}
          </label>
          <select
            id={`lost-reason-${waId}`}
            value={lostReason}
            disabled={busy}
            onChange={(e) => setLostReason(e.target.value)}
            className={SELECT_CLASS}
          >
            {labels.lostReasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className="flex justify-end">
            <InlineConfirm
              {...confirmProps}
              destructive
              onConfirm={() => void save("set-stage", { stage: lostKey, lostReason })}
              onCancel={close}
            />
          </div>
        </div>
      ) : null}
    </div>
  );

  // ── Presupuesto ──
  const parsedAmount = Number(amount.replace(/[^\d]/g, ""));
  const amountValid = Number.isInteger(parsedAmount) && parsedAmount > 0;
  const budgetChanged =
    !manualBudget || parsedAmount !== manualBudget.amount || currency !== manualBudget.currency;
  const saveBudget = () => {
    if (amountValid && budgetChanged) void save("set-budget", { amount: parsedAmount, currency });
  };
  const budgetEditor = (
    <form
      className="space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        saveBudget();
      }}
    >
      <div className="flex items-center gap-1.5">
        <label htmlFor={`budget-amount-${waId}`} className="sr-only">
          {labels.budget.amountLabel}
        </label>
        <input
          id={`budget-amount-${waId}`}
          data-testid="lead-budget-amount"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          placeholder={labels.budget.amountPlaceholder}
          value={amount}
          disabled={busy}
          onChange={(e) => setAmount(e.target.value)}
          className={cn(LEAD_FIELD_CLASS, "min-w-0 flex-1 tabular-nums")}
        />
        <label htmlFor={`budget-currency-${waId}`} className="sr-only">
          {labels.budget.currencyLabel}
        </label>
        <select
          id={`budget-currency-${waId}`}
          data-testid="lead-budget-currency"
          value={currency}
          disabled={busy}
          onChange={(e) => setCurrency(e.target.value)}
          className={cn(LEAD_FIELD_CLASS, "w-[84px] shrink-0")}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-between gap-2">
        {manualBudget ? (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            title={labels.budget.clearHint}
            data-testid="lead-budget-clear"
            disabled={busy}
            onClick={() => void save("set-budget", { amount: null })}
          >
            {labels.budget.clear}
          </Button>
        ) : (
          <span />
        )}
        <InlineConfirm
          {...confirmProps}
          confirmTestId="lead-budget-save"
          disabled={!amountValid || !budgetChanged}
          onConfirm={saveBudget}
          onCancel={close}
        />
      </div>
    </form>
  );

  // The row opened on mount (Nuevo lead) should be in view.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!initialField || !canEdit) return;
    rootRef.current
      ?.querySelector<HTMLElement>(`[data-field="${initialField}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [initialField, canEdit]);

  return (
    <div ref={rootRef} className="space-y-3">
      <dl className="space-y-1">
        <InlineField
          fieldKey="owner"
          label={labels.ownerLabel}
          editLabel={editLabel(labels.ownerLabel)}
          placeholder={labels.unassigned}
          value={
            view.ownerEmail ? (
              <span className="flex items-center gap-2">
                <LeadAvatar label={view.ownerLabel} seed={view.ownerEmail} emptyLabel={labels.unassigned} />
                <span data-testid="lead-owner" className="truncate font-medium">
                  {view.ownerLabel}
                </span>
              </span>
            ) : null
          }
          canEdit={canEdit && canReassign}
          editing={editing === "owner"}
          busy={busy && editing === "owner"}
          onOpen={() => open("owner")}
          onCancel={close}
          onOutside={close}
          editor={ownerEditor}
          extra={takeAction}
          hint={
            canEdit && !canReassign ? <span data-testid="lead-owner-locked">{labels.ownerLockedHint}</span> : null
          }
        />

        <InlineField
          fieldKey="reminder"
          label={labels.nextStepLabel}
          editLabel={editLabel(labels.nextStepLabel)}
          placeholder={labels.addValue}
          value={null}
          fixed={
            openReminder ? (
              <ReminderCallout
                reminder={openReminder}
                canEdit={canEdit}
                busy={busy}
                labels={labels}
                onDone={() => void save("reminder-done", {})}
                onChange={() => open("reminder")}
              />
            ) : undefined
          }
          canEdit={canEdit}
          editing={editing === "reminder"}
          busy={busy && editing === "reminder"}
          onOpen={() => open("reminder")}
          onCancel={close}
          onOutside={() => (canSaveReminder ? saveReminder() : close())}
          editor={reminderEditor}
        />

        <InlineField
          fieldKey="stage"
          label={labels.stageLabel}
          editLabel={editLabel(labels.stageLabel)}
          placeholder={labels.addValue}
          value={
            <LeadStageChip label={view.stageLabel} tone={view.tone} auto={view.auto} autoTitle={labels.autoStageDetail} />
          }
          canEdit={canEdit}
          editing={editing === "stage"}
          busy={busy && editing === "stage"}
          onOpen={() => open("stage")}
          onCancel={close}
          onOutside={close}
          editor={stageEditor}
          hint={
            view.statusText || view.auto ? (
              <>
                {view.statusText ? (
                  <p
                    data-testid="lead-status"
                    className={cn(
                      "text-[12px] font-medium",
                      view.statusTone === "danger"
                        ? "text-[var(--danger)]"
                        : "text-[color-mix(in_oklch,var(--warning)_70%,var(--ink))]",
                    )}
                  >
                    {view.statusText}
                  </p>
                ) : null}
                {view.auto ? <p title={labels.autoStageDetail}>{labels.autoStageHint}</p> : null}
              </>
            ) : null
          }
        />

        <InlineField
          fieldKey="priority"
          label={labels.priority.label}
          editLabel={editLabel(labels.priority.label)}
          placeholder={labels.priority.none}
          value={view.priority ? <LeadPriorityChip label={view.priority.label} tone={view.priority.tone} /> : null}
          canEdit={canEdit}
          editing={editing === "priority"}
          busy={busy && editing === "priority"}
          onOpen={() => open("priority")}
          onCancel={close}
          onOutside={close}
          editor={
            <>
              <label htmlFor={`priority-${waId}`} className="sr-only">
                {labels.priority.label}
              </label>
              <CommitSelect
                id={`priority-${waId}`}
                data-testid="lead-priority-select"
                autoFocus
                disabled={busy}
                value={view.priority?.key ?? ""}
                options={[{ key: "", label: labels.priority.none }, ...priorityOptions(labels)]}
                onCommit={(next) => {
                  if (next === (view.priority?.key ?? "")) return close();
                  void save("set-priority", { priority: next });
                }}
              />
            </>
          }
        />

        <div data-testid="lead-budget-section">
          <InlineField
            fieldKey="budget"
            label={labels.budget.label}
            editLabel={editLabel(labels.budget.label)}
            placeholder={labels.budget.none}
            value={
              view.budgetText ? (
                <span data-testid="lead-budget-value" className="font-medium tabular-nums">
                  {view.budgetText}
                </span>
              ) : null
            }
            canEdit={canEdit}
            editing={editing === "budget"}
            busy={busy && editing === "budget"}
            onOpen={() => open("budget")}
            onCancel={close}
            onOutside={() => (amountValid && budgetChanged ? saveBudget() : close())}
            editor={budgetEditor}
            hint={view.budget && view.budget.source === "bot" ? labels.budget.fromBot : null}
          />
        </div>
      </dl>
    </div>
  );
}

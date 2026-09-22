"use client";

// One row of a Jira-style "Details" list: label on the left, value on the
// right. With edit rights the value is a real button — hover shows a pencil,
// click (or Enter) swaps the value for the editor; Esc cancels and the focus
// returns to the value. Viewers get a plain value and no button at all.

import { useEffect, useRef, type ReactNode } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  fieldKey: string; // data-testid="lead-field-<key>"
  label: string;
  value: ReactNode | null; // null → placeholder
  placeholder: string;
  editLabel: string; // aria-label of the value button ("Editar Etapa")
  canEdit: boolean;
  editing: boolean;
  busy?: boolean;
  onOpen: () => void;
  onCancel: () => void;
  // Called on a click outside the editor while editing (the caller decides
  // whether that commits or cancels).
  onOutside?: () => void;
  editor: ReactNode;
  hint?: ReactNode; // small line under the row
  extra?: ReactNode; // quick action beside the value that does not open the editor
};

export function InlineField({
  fieldKey,
  label,
  value,
  placeholder,
  editLabel,
  canEdit,
  editing,
  busy = false,
  onOpen,
  onCancel,
  onOutside,
  editor,
  hint,
  extra,
}: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const wasEditing = useRef(false);

  // Focus returns to the value when the editor closes.
  useEffect(() => {
    if (wasEditing.current && !editing) buttonRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  useEffect(() => {
    if (!editing || !onOutside) return;
    function onPointerDown(e: PointerEvent) {
      const el = editorRef.current;
      if (el && !el.contains(e.target as Node)) onOutside?.();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [editing, onOutside]);

  const shown = value ?? <span className="italic text-[var(--soft-ink)]">{placeholder}</span>;

  return (
    <div className="space-y-1" data-field={fieldKey} aria-busy={busy || undefined}>
      <div className="grid grid-cols-[104px_minmax(0,1fr)] items-start gap-2">
        <dt className="pt-1.5 text-[12.5px] leading-snug text-[var(--soft-ink)]">{label}</dt>
        <dd className="min-w-0">
          {editing ? (
            <div
              ref={editorRef}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  onCancel();
                }
              }}
              className="space-y-1.5"
            >
              {editor}
            </div>
          ) : canEdit ? (
            <div className="flex items-center gap-1.5">
              <button
                ref={buttonRef}
                type="button"
                data-testid={`lead-field-${fieldKey}`}
                aria-label={editLabel}
                disabled={busy}
                onClick={onOpen}
                className={cn(
                  "group flex min-h-[32px] min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-[13px] text-[var(--ink)]",
                  "transition-colors duration-150 hover:bg-[var(--canvas-2)] disabled:cursor-default disabled:opacity-60",
                  "focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-1",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{shown}</span>
                {busy ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-[var(--soft-ink)]" aria-hidden />
                ) : (
                  <Pencil
                    className="size-3.5 shrink-0 text-[var(--soft-ink)] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                    aria-hidden
                  />
                )}
              </button>
              {extra}
            </div>
          ) : (
            <div className="flex min-h-[32px] items-center px-2 py-1 text-[13px] text-[var(--ink)]">
              <span className="min-w-0 flex-1 truncate">{shown}</span>
            </div>
          )}
        </dd>
      </div>
      {hint ? <div className="pl-[112px] text-[11.5px] leading-snug text-[var(--soft-ink)]">{hint}</div> : null}
    </div>
  );
}

type ConfirmProps = {
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  confirmTestId?: string;
};

/** The ✓ / ✗ pair every text editor ends with. */
export function InlineConfirm({
  onConfirm,
  onCancel,
  confirmLabel,
  cancelLabel,
  busy,
  disabled,
  destructive,
  confirmTestId,
}: ConfirmProps) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        size="icon-xs"
        variant={destructive ? "destructive" : "default"}
        aria-label={confirmLabel}
        title={confirmLabel}
        data-testid={confirmTestId ?? "lead-field-confirm"}
        disabled={busy || disabled}
        onClick={onConfirm}
      >
        {busy ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
      </Button>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label={cancelLabel}
        title={cancelLabel}
        data-testid="lead-field-cancel"
        disabled={busy}
        onClick={onCancel}
      >
        <X className="size-3.5" aria-hidden />
      </Button>
    </span>
  );
}

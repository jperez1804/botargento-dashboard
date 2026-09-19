"use client";

// One card on the /leads board. The name opens the conversation; the card is
// draggable between columns (native HTML5 DnD) and also carries a "Mover a…"
// select — the keyboard / touch path, and what the e2e drives.

import Link from "next/link";
import { BellRing, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEAD_FIELD_CLASS } from "@/components/dashboard/lead-field-class";
import type { CrmLabels } from "@/config/verticals/_types";

export type BoardCard = {
  waId: string;
  displayName: string;
  stageKey: string;
  auto: boolean;
  ownerLabel: string;
  hasOwner: boolean;
  statusText: string | null;
  statusTone: "danger" | "warning" | null;
  reminderText: string | null;
  reminderOverdue: boolean;
};

type Props = {
  card: BoardCard;
  stages: ReadonlyArray<{ key: string; label: string }>;
  labels: CrmLabels;
  canEdit: boolean;
  busy: boolean;
  onMove: (waId: string, stage: string) => void;
};

export function LeadCard({ card, stages, labels, canEdit, busy, onMove }: Props) {
  return (
    <article
      data-lead-card={card.waId}
      draggable={canEdit && !busy}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", card.waId);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "group/card space-y-2 rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-3 text-[13px]",
        canEdit && "cursor-grab active:cursor-grabbing",
        busy && "opacity-60",
      )}
    >
      <div className="flex items-start gap-1.5">
        {canEdit ? (
          <GripVertical
            className="mt-0.5 size-3.5 shrink-0 text-[var(--faint-ink)] group-hover/card:text-[var(--soft-ink)]"
            aria-hidden
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <Link
            href={`/conversations/${encodeURIComponent(card.waId)}`}
            className="block font-medium text-[var(--ink)] truncate hover:underline underline-offset-2"
          >
            {card.displayName}
          </Link>
          <p className={cn("text-[12px] truncate", card.hasOwner ? "text-[var(--muted-ink)]" : "text-[var(--soft-ink)] italic")}>
            {card.ownerLabel}
          </p>
        </div>
      </div>

      {card.statusText ? (
        <p
          className={cn(
            "text-[11.5px] font-medium",
            card.statusTone === "danger"
              ? "text-[var(--danger)]"
              : "text-[color-mix(in_oklch,var(--warning)_70%,var(--ink))]",
          )}
        >
          {card.statusText}
        </p>
      ) : null}

      {card.reminderText ? (
        <p
          className={cn(
            "flex items-center gap-1 text-[11.5px] tabular-nums",
            card.reminderOverdue ? "text-[var(--danger)] font-medium" : "text-[var(--muted-ink)]",
          )}
        >
          <BellRing className="size-3 shrink-0" aria-hidden />
          {card.reminderText}
        </p>
      ) : null}

      {canEdit ? (
        <select
          aria-label={`${labels.moveTo} ${card.displayName}`}
          data-testid="lead-move"
          value=""
          disabled={busy}
          onChange={(e) => {
            if (e.target.value) onMove(card.waId, e.target.value);
          }}
          className={cn(LEAD_FIELD_CLASS, "h-7 text-[12px] text-[var(--muted-ink)]")}
        >
          <option value="">{labels.moveTo}</option>
          {stages
            .filter((s) => s.key !== card.stageKey)
            .map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
        </select>
      ) : null}
    </article>
  );
}

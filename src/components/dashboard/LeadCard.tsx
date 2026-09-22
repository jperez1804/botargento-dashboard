"use client";

// One card on the /leads board, Jira-style: the name (or the card body) opens
// the lead's card as a modal over the board (/leads/[waId], intercepted),
// the state lines flag what needs attention, and the actions hide behind the ⋯
// menu (move) and the owner avatar (assign). Dragging between columns still
// works; the menu is the keyboard and touch path.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, Clock3, MessageCircle, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { LeadAvatar } from "@/components/dashboard/LeadAvatar";
import { LeadCardMenu } from "@/components/dashboard/LeadCardMenu";
import { LeadPriorityChip } from "@/components/dashboard/LeadPriorityChip";
import type { CrmLabels, CrmPriorityKey } from "@/config/verticals/_types";
import type { PriorityView } from "@/lib/crm/priority";

export type BoardCard = {
  waId: string;
  displayName: string;
  stageKey: string;
  auto: boolean;
  ownerEmail: string | null;
  ownerLabel: string;
  statusText: string | null;
  statusTone: "danger" | "warning" | null;
  reminderText: string | null;
  reminderNote: string | null;
  reminderOverdue: boolean;
  lastActivity: string;
  budgetText: string | null;
  daysInStage: string | null;
  // Origin of a lead registered by hand ("Portal inmobiliario"); null = WhatsApp.
  sourceLabel: string | null;
  priority: PriorityView | null;
  // WhatsApp intent bucket ("Ventas"); null for leads that never wrote.
  intentLabel: string | null;
};

type Props = {
  card: BoardCard;
  stages: ReadonlyArray<{ key: string; label: string }>;
  members: ReadonlyArray<{ email: string; label: string }>;
  labels: CrmLabels;
  canEdit: boolean;
  isAdmin: boolean;
  sessionEmail: string;
  busy: boolean;
  onMove: (waId: string, stage: string) => void;
  onAssign: (waId: string, ownerEmail: string | null) => void;
  onSetPriority: (waId: string, priority: CrmPriorityKey | "") => void;
};

export function LeadCard({
  card,
  stages,
  members,
  labels,
  canEdit,
  isAdmin,
  sessionEmail,
  busy,
  onMove,
  onAssign,
  onSetPriority,
}: Props) {
  const router = useRouter();
  const menuCard = { ...card, priorityKey: card.priority?.key ?? null };
  const detailHref = `/leads/${encodeURIComponent(card.waId)}`;
  // Clicking the card body (not a link, button or menu) opens the modal too;
  // scroll: false keeps the board where it is.
  function openFromBody(e: React.MouseEvent<HTMLElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("a,button,[role='menu'],[role='menuitem'],input,select")) return;
    router.push(detailHref, { scroll: false });
  }
  // Mirror the API rule (403 not_owner): an asesor manages unassigned leads
  // and their own; reassigning a colleague's lead is an admin call.
  const canAssign =
    canEdit && (isAdmin || card.ownerEmail === null || card.ownerEmail === sessionEmail);

  return (
    <article
      data-lead-card={card.waId}
      draggable={canEdit && !busy}
      onClick={openFromBody}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", card.waId);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "group/card space-y-1.5 rounded-lg border border-[var(--rule)] bg-[var(--surface)] p-3",
        "shadow-xs transition-shadow duration-150 hover:shadow-sm cursor-pointer",
        canEdit && "active:cursor-grabbing",
        busy && "opacity-60",
      )}
    >
      <div className="flex items-start gap-1.5">
        {/* inline-block: the pointer + underline stay on the text, not across
            the whole card. */}
        <Link
          href={detailHref}
          scroll={false}
          data-testid="lead-open"
          className="inline-block w-fit max-w-full flex-1 truncate text-[13.5px] font-medium text-[var(--ink)] hover:underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-2 rounded-sm"
        >
          {card.displayName}
        </Link>
        {canEdit ? (
          <LeadCardMenu
            variant="move"
            card={menuCard}
            stages={stages}
            members={members}
            sessionEmail={sessionEmail}
            labels={labels}
            disabled={busy}
            onMove={onMove}
            onAssign={onAssign}
            onSetPriority={onSetPriority}
          />
        ) : null}
      </div>

      {card.sourceLabel || card.priority || card.intentLabel ? (
        <div className="flex flex-wrap items-center gap-1">
          {card.priority ? (
            <LeadPriorityChip label={card.priority.label} tone={card.priority.tone} />
          ) : null}
          {card.intentLabel ? (
            <span
              data-testid="lead-intent"
              className="inline-flex h-[18px] items-center rounded-full bg-[var(--info-soft)] px-1.5 text-[10.5px] font-medium text-[var(--info)]"
            >
              {card.intentLabel}
            </span>
          ) : null}
          {card.sourceLabel ? (
            <span
              data-testid="lead-source"
              className="inline-flex h-[18px] items-center rounded-full border border-[var(--rule)] px-1.5 text-[10.5px] text-[var(--muted-ink)]"
            >
              {card.sourceLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      {card.budgetText ? (
        <p
          data-testid="lead-budget"
          className="flex items-center gap-1 text-[12.5px] font-medium tabular-nums text-[var(--ink)]"
        >
          <Wallet className="size-3.5 shrink-0 text-[var(--soft-ink)]" aria-hidden />
          {card.budgetText}
        </p>
      ) : null}

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
            card.reminderOverdue ? "font-medium text-[var(--danger)]" : "text-[var(--muted-ink)]",
          )}
        >
          <BellRing className="size-3 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">
            {card.reminderText}
            {card.reminderNote ? (
              <span className="font-normal text-[var(--muted-ink)]"> · {card.reminderNote}</span>
            ) : null}
          </span>
        </p>
      ) : null}

      <div className="flex items-end justify-between gap-2 pt-0.5">
        <div className="min-w-0 space-y-0.5 text-[11.5px] text-[var(--soft-ink)]">
          <p className="flex items-center gap-1 font-[var(--font-geist-mono)] tabular-nums">
            <MessageCircle className="size-3 shrink-0" aria-hidden />
            {card.waId}
          </p>
          <p className="flex flex-wrap items-center gap-x-1">
            <Clock3 className="size-3 shrink-0" aria-hidden />
            {card.lastActivity}
            {card.daysInStage ? (
              <span className="text-[var(--faint-ink)]">· {card.daysInStage}</span>
            ) : null}
          </p>
        </div>
        {canAssign ? (
          <LeadCardMenu
            variant="assign"
            card={menuCard}
            stages={stages}
            members={members}
            sessionEmail={sessionEmail}
            labels={labels}
            disabled={busy}
            onMove={onMove}
            onAssign={onAssign}
            onSetPriority={onSetPriority}
          />
        ) : (
          <LeadAvatar
            label={card.ownerEmail ? card.ownerLabel : null}
            seed={card.ownerEmail ?? undefined}
            emptyLabel={labels.unassigned}
          />
        )}
      </div>
    </article>
  );
}

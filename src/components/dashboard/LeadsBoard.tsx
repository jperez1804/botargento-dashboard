"use client";

// /leads board: one column per pipeline stage, Jira-style (tinted column with
// a flat header + count, cards on a light surface). Moving a card (drag or the
// ⋯ menu) and assigning an owner (avatar menu) are optimistic: the card jumps
// immediately, then /api/leads/* confirms; on error it jumps back with a toast.
// Columns scroll horizontally when the viewport is narrower than the pipeline.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LeadCard, type BoardCard } from "@/components/dashboard/LeadCard";
import { errorText, postLead } from "@/lib/crm/api-client";
import type { CrmLabels, CrmStageTone } from "@/config/verticals/_types";

export type BoardColumn = {
  key: string;
  label: string;
  tone: CrmStageTone;
  total: number;
  cards: ReadonlyArray<BoardCard>;
};

type Props = {
  columns: ReadonlyArray<BoardColumn>;
  members: ReadonlyArray<{ email: string; label: string }>;
  labels: CrmLabels;
  canEdit: boolean;
  isAdmin: boolean;
  sessionEmail: string;
};

const DOT_TONE: Record<CrmStageTone, string> = {
  neutral: "bg-[var(--faint-ink)]",
  info: "bg-[var(--info)]",
  progress: "bg-[var(--warning)]",
  good: "bg-[var(--positive)]",
  bad: "bg-[var(--danger)]",
};

export function LeadsBoard({ columns, members, labels, canEdit, isAdmin, sessionEmail }: Props) {
  const router = useRouter();
  // waId → value the user just chose, pending server confirmation.
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [assigned, setAssigned] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const stages = columns.map((c) => ({ key: c.key, label: c.label }));
  const allCards = columns.flatMap((c) => c.cards);
  const stageOf = (card: BoardCard) => moved[card.waId] ?? card.stageKey;
  const ownerOf = (card: BoardCard) =>
    card.waId in assigned ? (assigned[card.waId] ?? null) : card.ownerEmail;

  function rollback<T>(setter: (fn: (prev: Record<string, T>) => Record<string, T>) => void, waId: string) {
    setter((prev) => {
      const next = { ...prev };
      delete next[waId];
      return next;
    });
  }

  async function run(
    waId: string,
    body: Record<string, unknown>,
    path: "set-stage" | "assign",
    undo: () => void,
  ) {
    setBusy((b) => ({ ...b, [waId]: true }));
    const res = await postLead(path, { contactWaId: waId, ...body });
    setBusy((b) => ({ ...b, [waId]: false }));
    if (res.ok) {
      toast.success(labels.saved);
      router.refresh();
    } else {
      undo();
      toast.error(errorText(labels.errors, res.error));
      if (res.error === "already_owned") router.refresh();
    }
  }

  async function move(waId: string, stage: string) {
    const card = allCards.find((c) => c.waId === waId);
    if (!card || stageOf(card) === stage) return;
    setMoved((m) => ({ ...m, [waId]: stage }));
    await run(waId, { stage }, "set-stage", () => rollback(setMoved, waId));
  }

  async function assign(waId: string, ownerEmail: string | null) {
    const card = allCards.find((c) => c.waId === waId);
    if (!card || ownerOf(card) === ownerEmail) return;
    const claimingUnowned = ownerOf(card) === null && ownerEmail === sessionEmail;
    setAssigned((a) => ({ ...a, [waId]: ownerEmail }));
    await run(
      waId,
      { ownerEmail, ...(claimingUnowned ? { take: true } : {}) },
      "assign",
      () => rollback(setAssigned, waId),
    );
  }

  const ownerLabelOf = (email: string | null) =>
    email ? (members.find((m) => m.email === email)?.label ?? email) : labels.unassigned;

  return (
    <div data-board-bleed className="overflow-x-auto pb-2">
      {/* 210px keeps the 7 stages inside a 1920px screen (they stretch to fill
        * it); narrower viewports scroll horizontally instead of squeezing. */}
      <div className="grid w-full min-w-max grid-flow-col auto-cols-[minmax(210px,1fr)] gap-3">
        {columns.map((col) => {
          const cards = allCards.filter((c) => stageOf(c) === col.key);
          const extra = Math.max(0, col.total - col.cards.length);
          const movedOut = col.cards.length - col.cards.filter((c) => cards.includes(c)).length;
          const movedIn = cards.filter((c) => c.stageKey !== col.key).length;
          const count = col.total - movedOut + movedIn;
          return (
            <section
              key={col.key}
              data-board-column={col.key}
              aria-label={col.label}
              onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDropTarget(col.key);
              }}
              onDragLeave={() => setDropTarget((t) => (t === col.key ? null : t))}
              onDrop={(e) => {
                e.preventDefault();
                setDropTarget(null);
                const waId = e.dataTransfer.getData("text/plain");
                if (waId) void move(waId, col.key);
              }}
              className={cn(
                "flex min-h-[180px] flex-col gap-2 rounded-xl border p-2 transition-colors",
                dropTarget === col.key
                  ? "border-[color-mix(in_oklch,var(--client-primary)_55%,var(--rule))] bg-[color-mix(in_oklch,var(--client-primary)_6%,var(--canvas-2))]"
                  : "border-[var(--rule)] bg-[var(--canvas-2)]",
              )}
            >
              <header className="flex items-center gap-2 px-1.5 py-1">
                <span className={cn("size-1.5 shrink-0 rounded-full", DOT_TONE[col.tone])} aria-hidden />
                <h2 className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-ink)]">
                  {col.label}
                </h2>
                <span
                  data-column-count
                  className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--neutral-soft)] px-1.5 text-[11px] font-medium tabular-nums text-[var(--muted-ink)]"
                >
                  {count}
                </span>
              </header>

              {cards.length === 0 ? (
                <p className="px-1 py-6 text-center text-[12px] text-[var(--faint-ink)]">
                  {labels.emptyColumn}
                </p>
              ) : (
                cards.map((card) => (
                  <LeadCard
                    key={card.waId}
                    card={{
                      ...card,
                      stageKey: stageOf(card),
                      ownerEmail: ownerOf(card),
                      ownerLabel: ownerLabelOf(ownerOf(card)),
                    }}
                    stages={stages}
                    members={members}
                    labels={labels}
                    canEdit={canEdit}
                    isAdmin={isAdmin}
                    sessionEmail={sessionEmail}
                    busy={busy[card.waId] === true}
                    onMove={(id, stage) => void move(id, stage)}
                    onAssign={(id, owner) => void assign(id, owner)}
                  />
                ))
              )}

              {extra > 0 ? (
                <p className="px-1 text-center text-[11.5px] text-[var(--soft-ink)]">+{extra}</p>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

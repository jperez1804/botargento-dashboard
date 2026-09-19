"use client";

// /leads board: one column per pipeline stage. Moving a card (drag or "Mover
// a…") is optimistic — the card jumps immediately, then /api/leads/set-stage
// confirms; on error it jumps back with a toast. Columns scroll horizontally
// on narrow screens.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LeadCard, type BoardCard } from "@/components/dashboard/LeadCard";
import { LeadStageChip } from "@/components/dashboard/LeadStageChip";
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
  labels: CrmLabels;
  canEdit: boolean;
};

export function LeadsBoard({ columns, labels, canEdit }: Props) {
  const router = useRouter();
  // waId → stage the user just moved it to (pending server confirmation).
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const stages = columns.map((c) => ({ key: c.key, label: c.label }));
  const allCards = columns.flatMap((c) => c.cards);

  async function move(waId: string, stage: string) {
    const card = allCards.find((c) => c.waId === waId);
    if (!card || (moved[waId] ?? card.stageKey) === stage) return;
    setMoved((m) => ({ ...m, [waId]: stage }));
    setBusy((b) => ({ ...b, [waId]: true }));
    const res = await postLead("set-stage", { contactWaId: waId, stage });
    setBusy((b) => ({ ...b, [waId]: false }));
    if (res.ok) {
      toast.success(labels.saved);
      router.refresh();
    } else {
      setMoved((m) => {
        const next = { ...m };
        delete next[waId];
        return next;
      });
      toast.error(errorText(labels.errors, res.error));
    }
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid auto-cols-[minmax(230px,1fr)] grid-flow-col gap-3 min-w-max lg:min-w-0">
        {columns.map((col) => {
          const cards = allCards.filter((c) => (moved[c.waId] ?? c.stageKey) === col.key);
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
                "flex flex-col gap-2 rounded-xl border bg-[var(--canvas-2)] p-2.5 min-h-[160px] transition-colors",
                dropTarget === col.key
                  ? "border-[color-mix(in_oklch,var(--client-primary)_55%,var(--rule))] bg-[color-mix(in_oklch,var(--client-primary)_6%,var(--canvas-2))]"
                  : "border-[var(--rule)]",
              )}
            >
              <header className="flex items-center justify-between gap-2 px-0.5">
                <LeadStageChip label={col.label} tone={col.tone} />
                <span data-column-count className="text-[12px] tabular-nums text-[var(--soft-ink)]">
                  {count}
                </span>
              </header>
              {cards.length === 0 ? (
                <p className="px-1 py-4 text-center text-[12px] text-[var(--faint-ink)]">{labels.emptyColumn}</p>
              ) : (
                cards.map((card) => (
                  <LeadCard
                    key={card.waId}
                    card={card}
                    stages={stages}
                    labels={labels}
                    canEdit={canEdit}
                    busy={busy[card.waId] === true}
                    onMove={(id, stage) => void move(id, stage)}
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

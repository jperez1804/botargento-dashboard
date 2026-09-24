"use client";

// /leads board: one column per pipeline stage, Jira-style (tinted column with
// a flat header + count, cards on a light surface). Moving a card (drag or the
// ⋯ menu) and assigning an owner (avatar menu) are optimistic: the card jumps
// immediately, then /api/leads/* confirms; on error it jumps back with a toast.
// Every successful change offers "Deshacer" in its toast. Moving into the
// lost stage asks for a motive first. Terminal columns (Cerrado, Perdido) are
// collapsed rails unless ?open= lists them. Columns scroll horizontally when
// the viewport is narrower than the pipeline.

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsLeftRight, Lock, SearchX } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { clearLeadsFilters } from "@/lib/crm/filter-memory";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadCard, type BoardCard } from "@/components/dashboard/LeadCard";
import { LostReasonPanel } from "@/components/dashboard/LostReasonPanel";
import { errorText, postLead, type LeadApiPath } from "@/lib/crm/api-client";
import { STAGE_DOT_CLASS } from "@/components/dashboard/lead-field-class";
import { priorityView } from "@/lib/crm/priority";
import { fillTemplate } from "@/lib/crm/view-model";
import type { CrmLabels, CrmPriorityKey, CrmStageTone } from "@/config/verticals/_types";

export type BoardColumn = {
  key: string;
  label: string;
  tone: CrmStageTone;
  total: number;
  // Sum of the column budgets per currency ("USD 450.000 · ARS 30.000.000");
  // computed server-side over every lead in the stage, not just the shown ones.
  budgetTotal: string | null;
  // Who moves a lead here ("La mueve el bot" / "La marca un asesor"…).
  moverLabel: string;
  manualOnly: boolean;
  // Terminal columns collapse to a rail by default.
  terminal: boolean;
  cards: ReadonlyArray<BoardCard>;
  // Lista filtered by this stage, for the "+N" under the capped cards.
  moreHref: string;
};

type Props = {
  columns: ReadonlyArray<BoardColumn>;
  members: ReadonlyArray<{ email: string; label: string }>;
  labels: CrmLabels;
  canEdit: boolean;
  isAdmin: boolean;
  sessionEmail: string;
  lostKey: string;
  // Terminal columns currently expanded (?open=).
  openKeys: ReadonlyArray<string>;
  // Filters are active → an all-empty board shows "nothing matches" + clear.
  filtersActive: boolean;
  clearHref: string;
};

export function LeadsBoard({
  columns,
  members,
  labels,
  canEdit,
  isAdmin,
  sessionEmail,
  lostKey,
  openKeys,
  filtersActive,
  clearHref,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // waId → value the user just chose, pending server confirmation.
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [assigned, setAssigned] = useState<Record<string, string | null>>({});
  const [prioritized, setPrioritized] = useState<Record<string, CrmPriorityKey | null>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // A card dropped on Perdido waits here for its motive.
  const [pendingLost, setPendingLost] = useState<{ waId: string; from: string } | null>(null);
  // Expanded terminal columns: the URL plus anything expanded in this session
  // (dropping on a rail expands it so the motive panel is visible).
  const [expanded, setExpanded] = useState<string[]>([...openKeys]);

  const stages = columns.map((c) => ({ key: c.key, label: c.label }));
  const allCards = columns.flatMap((c) => c.cards);
  const stageOf = (card: BoardCard) => moved[card.waId] ?? card.stageKey;
  const ownerOf = (card: BoardCard) =>
    card.waId in assigned ? (assigned[card.waId] ?? null) : card.ownerEmail;
  const priorityOf = (card: BoardCard) =>
    card.waId in prioritized ? priorityView(prioritized[card.waId] ?? null, labels) : card.priority;
  const stageLabel = (key: string) => stages.find((s) => s.key === key)?.label ?? key;
  const ownerLabelOf = (email: string | null) =>
    email ? (members.find((m) => m.email === email)?.label ?? email) : labels.unassigned;

  function rollback<T>(setter: (fn: (prev: Record<string, T>) => Record<string, T>) => void, waId: string) {
    setter((prev) => {
      const next = { ...prev };
      delete next[waId];
      return next;
    });
  }

  function setOpen(keys: string[]) {
    setExpanded(keys);
    const params = new URLSearchParams(searchParams.toString());
    if (keys.length) params.set("open", keys.join(","));
    else params.delete("open");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  const expand = (key: string) => {
    if (!expanded.includes(key)) setOpen([...expanded, key]);
  };

  async function run(
    waId: string,
    body: Record<string, unknown>,
    path: LeadApiPath,
    undoOptimistic: () => void,
    done?: { text: string; revert: () => void },
  ) {
    setBusy((b) => ({ ...b, [waId]: true }));
    const res = await postLead(path, { contactWaId: waId, ...body });
    setBusy((b) => ({ ...b, [waId]: false }));
    if (res.ok) {
      if (done) toast.success(done.text, { action: { label: labels.undo, onClick: done.revert } });
      else toast.success(labels.saved);
      router.refresh();
    } else {
      undoOptimistic();
      toast.error(errorText(labels.errors, res.error));
      if (res.error === "already_owned") router.refresh();
    }
  }

  async function saveStage(waId: string, stage: string, from: string, lostReason?: string) {
    const card = allCards.find((c) => c.waId === waId);
    if (!card) return;
    await run(
      waId,
      { stage, ...(lostReason ? { lostReason } : {}) },
      "set-stage",
      () => rollback(setMoved, waId),
      {
        text: fillTemplate(labels.movedToastTemplate, { name: card.displayName, stage: stageLabel(stage) }),
        revert: () => {
          setMoved((m) => ({ ...m, [waId]: from }));
          void run(waId, { stage: from }, "set-stage", () => rollback(setMoved, waId));
        },
      },
    );
  }

  function move(waId: string, stage: string) {
    const card = allCards.find((c) => c.waId === waId);
    if (!card || stageOf(card) === stage) return;
    const from = stageOf(card);
    setMoved((m) => ({ ...m, [waId]: stage }));
    if (stage === lostKey) {
      // Land the card in Perdido and ask for the motive before saving.
      expand(lostKey);
      setPendingLost({ waId, from });
      return;
    }
    void saveStage(waId, stage, from);
  }

  function cancelLost() {
    if (pendingLost) rollback(setMoved, pendingLost.waId);
    setPendingLost(null);
  }

  async function confirmLost(reason: string) {
    if (!pendingLost) return;
    const { waId, from } = pendingLost;
    setPendingLost(null);
    await saveStage(waId, lostKey, from, reason);
  }

  async function assign(waId: string, ownerEmail: string | null) {
    const card = allCards.find((c) => c.waId === waId);
    if (!card || ownerOf(card) === ownerEmail) return;
    const from = ownerOf(card);
    const claimingUnowned = from === null && ownerEmail === sessionEmail;
    setAssigned((a) => ({ ...a, [waId]: ownerEmail }));
    await run(
      waId,
      { ownerEmail, ...(claimingUnowned ? { take: true } : {}) },
      "assign",
      () => rollback(setAssigned, waId),
      {
        text: fillTemplate(labels.assignedToastTemplate, { name: card.displayName, owner: ownerLabelOf(ownerEmail) }),
        revert: () => {
          setAssigned((a) => ({ ...a, [waId]: from }));
          void run(waId, { ownerEmail: from }, "assign", () => rollback(setAssigned, waId));
        },
      },
    );
  }

  async function setPriority(waId: string, priority: CrmPriorityKey | "") {
    const card = allCards.find((c) => c.waId === waId);
    if (!card || (priorityOf(card)?.key ?? null) === (priority || null)) return;
    const from = priorityOf(card)?.key ?? "";
    setPrioritized((p) => ({ ...p, [waId]: priority || null }));
    await run(waId, { priority }, "set-priority", () => rollback(setPrioritized, waId), {
      text: fillTemplate(labels.priorityToastTemplate, {
        name: card.displayName,
        priority: priority ? labels.priority.names[priority] : labels.priority.none,
      }),
      revert: () => {
        setPrioritized((p) => ({ ...p, [waId]: from || null }));
        void run(waId, { priority: from }, "set-priority", () => rollback(setPrioritized, waId));
      },
    });
  }

  const visibleCards = columns.map((col) => allCards.filter((c) => stageOf(c) === col.key));
  const boardEmpty = visibleCards.every((cards) => cards.length === 0);
  if (boardEmpty) {
    return (
      <EmptyState
        icon={<SearchX className="size-5" aria-hidden />}
        title={filtersActive ? labels.emptyFiltered : labels.emptyFirstRun}
        action={
          filtersActive ? (
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              data-testid="board-clear-filters"
              render={<Link href={clearHref} onClick={clearLeadsFilters} />}
            >
              {labels.clearFilters}
            </Button>
          ) : undefined
        }
      />
    );
  }

  const dragHandlers = (key: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!canEdit) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTarget(key);
    },
    onDragLeave: () => setDropTarget((t) => (t === key ? null : t)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDropTarget(null);
      const waId = e.dataTransfer.getData("text/plain");
      if (waId) move(waId, key);
    },
  });
  const columnTone = (key: string) =>
    dropTarget === key
      ? "border-[color-mix(in_oklch,var(--client-primary)_55%,var(--rule))] bg-[color-mix(in_oklch,var(--client-primary)_6%,var(--canvas-2))]"
      : "border-[var(--rule)] bg-[var(--canvas-2)]";

  return (
    <div className="overflow-x-auto pb-2">
      {/* 210px keeps the working stages inside a laptop screen once the
        * terminal columns collapse to 48px rails; narrower viewports scroll. */}
      <div className="flex w-full min-w-max items-stretch gap-3">
        {columns.map((col, i) => {
          const cards = visibleCards[i] ?? [];
          const extra = Math.max(0, col.total - col.cards.length);
          const movedOut = col.cards.length - col.cards.filter((c) => cards.includes(c)).length;
          const movedIn = cards.filter((c) => c.stageKey !== col.key).length;
          const count = col.total - movedOut + movedIn;
          const collapsed = col.terminal && !expanded.includes(col.key);

          if (collapsed) {
            return (
              <button
                key={col.key}
                type="button"
                data-board-rail={col.key}
                aria-label={fillTemplate(labels.expandColumnTemplate, { stage: col.label })}
                title={fillTemplate(labels.expandColumnTemplate, { stage: col.label })}
                onClick={() => expand(col.key)}
                {...dragHandlers(col.key)}
                className={cn(
                  "flex w-12 shrink-0 cursor-pointer flex-col items-center gap-2 rounded-xl border px-1 py-3 transition-colors hover:border-[var(--rule-strong)]",
                  "focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)]",
                  columnTone(col.key),
                )}
              >
                <span className={cn("size-1.5 rounded-full", STAGE_DOT_CLASS[col.tone])} aria-hidden />
                <span
                  data-column-count
                  className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--neutral-soft)] px-1.5 text-[11px] font-medium tabular-nums text-[var(--muted-ink)]"
                >
                  {count}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-ink)] [writing-mode:vertical-rl]">
                  {col.label}
                </span>
                <ChevronsLeftRight className="mt-auto size-3.5 text-[var(--soft-ink)]" aria-hidden />
              </button>
            );
          }

          return (
            <section
              key={col.key}
              data-board-column={col.key}
              aria-label={`${col.label} · ${count}`}
              {...dragHandlers(col.key)}
              className={cn(
                "flex min-h-[180px] w-[210px] flex-1 flex-col gap-2 rounded-xl border p-2 transition-colors",
                columnTone(col.key),
              )}
            >
              <header className="flex items-center gap-2 px-1.5 py-1">
                <span className={cn("size-1.5 shrink-0 rounded-full", STAGE_DOT_CLASS[col.tone])} aria-hidden />
                <h2 className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-ink)]">
                  {col.label}
                </h2>
                {col.manualOnly ? (
                  <Lock data-column-lock className="size-3 shrink-0 text-[var(--soft-ink)]" aria-hidden />
                ) : null}
                <span
                  data-column-count
                  className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--neutral-soft)] px-1.5 text-[11px] font-medium tabular-nums text-[var(--muted-ink)]"
                >
                  {count}
                </span>
                {col.terminal ? (
                  <button
                    type="button"
                    aria-label={labels.collapseColumn}
                    title={labels.collapseColumn}
                    onClick={() => setOpen(expanded.filter((k) => k !== col.key))}
                    className="cursor-pointer rounded text-[var(--soft-ink)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)]"
                  >
                    <ChevronsLeftRight className="size-3.5" aria-hidden />
                  </button>
                ) : null}
              </header>
              <p data-column-mover className="-mt-1.5 px-1.5 text-[11px] text-[var(--muted-ink)]">
                {col.moverLabel}
              </p>
              {col.budgetTotal ? (
                <p
                  data-column-budget
                  className="-mt-1 px-1.5 text-[11.5px] font-medium tabular-nums text-[var(--muted-ink)]"
                >
                  {col.budgetTotal}
                </p>
              ) : null}

              {pendingLost && col.key === lostKey ? (
                <LostReasonPanel
                  leadName={allCards.find((c) => c.waId === pendingLost.waId)?.displayName ?? ""}
                  labels={labels}
                  busy={busy[pendingLost.waId] === true}
                  onConfirm={(reason) => void confirmLost(reason)}
                  onCancel={cancelLost}
                />
              ) : null}

              {cards.length === 0 ? (
                <p className="px-1 py-6 text-center text-[12px] text-[var(--soft-ink)]">
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
                      priority: priorityOf(card),
                    }}
                    stages={stages}
                    members={members}
                    labels={labels}
                    canEdit={canEdit}
                    isAdmin={isAdmin}
                    sessionEmail={sessionEmail}
                    busy={busy[card.waId] === true}
                    onMove={(id, stage) => move(id, stage)}
                    onAssign={(id, owner) => void assign(id, owner)}
                    onSetPriority={(id, p) => void setPriority(id, p)}
                  />
                ))
              )}

              {extra > 0 ? (
                <Link
                  href={col.moreHref}
                  data-testid="board-more"
                  className="block px-1 py-1 text-center text-[11.5px] font-medium text-[var(--muted-ink)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
                >
                  {fillTemplate(labels.moreInListTemplate, { n: extra })}
                </Link>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

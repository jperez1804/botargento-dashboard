"use client";

// Filter bar for /leads. Everything lives in the URL (?stage=&owner=&filter=
// &mine=1&q=&view=) so views are shareable and survive refresh; defaults are
// omitted to keep URLs clean. The server does the filtering.

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEAD_FIELD_CLASS } from "@/components/dashboard/lead-field-class";
import type { CrmLabels, CrmPriorityKey } from "@/config/verticals/_types";
import { priorityOptions } from "@/lib/crm/priority";
import type { LeadListFilter } from "@/lib/queries/leads";

type Props = {
  labels: CrmLabels;
  stages: ReadonlyArray<{ key: string; label: string; count: number }>;
  owners: ReadonlyArray<{ email: string; label: string }>;
  intents: ReadonlyArray<{ key: string; label: string }>;
  current: {
    q: string;
    stage: string;
    owner: string;
    filter: LeadListFilter | "";
    mine: boolean;
    priority: CrmPriorityKey | "";
    intent: string;
    view: "list" | "board";
  };
  showOwnerFilter: boolean;
  showMine: boolean;
};

const CHIP =
  "inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full border text-[12.5px] font-medium cursor-pointer touch-manipulation transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-2";
const CHIP_ON =
  "border-[color-mix(in_oklch,var(--client-primary)_55%,var(--rule))] bg-[color-mix(in_oklch,var(--client-primary)_12%,var(--surface))] text-[var(--ink)] font-semibold";
const CHIP_OFF =
  "border-[var(--rule)] bg-[var(--canvas-2)] text-[var(--muted-ink)] hover:text-[var(--ink)] hover:border-[var(--rule-strong)]";

export function LeadsFilters({ labels, stages, owners, intents, current, showOwnerFilter, showMine }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(current.q);
  const [prevQ, setPrevQ] = useState(current.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (current.q !== prevQ) {
    setPrevQ(current.q);
    setSearch(current.q);
  }

  function navigate(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function onSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate({ q: value.trim() || null }), 300);
  }

  const activeCount = [current.q, current.stage, current.owner, current.filter, current.priority, current.intent]
    .filter(Boolean).length + (current.mine ? 1 : 0);
  function clearAll() {
    setSearch("");
    navigate({ q: null, stage: null, owner: null, mine: null, filter: null, priority: null, intent: null });
  }

  const quick: ReadonlyArray<{ key: LeadListFilter; label: string }> = [
    { key: "at_risk", label: labels.filterAtRisk },
    { key: "overdue", label: labels.filterOverdue },
    { key: "unassigned", label: labels.filterUnassigned },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-[420px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--soft-ink)]"
            aria-hidden="true"
          />
          <input
            id="leads-search"
            type="search"
            aria-label={labels.searchPlaceholder}
            placeholder={labels.searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            maxLength={80}
            className={cn(LEAD_FIELD_CLASS, "h-9 rounded-lg pl-9 text-[13.5px]")}
          />
        </div>

        {showOwnerFilter ? (
          <select
            aria-label={labels.columnOwner}
            value={current.owner}
            onChange={(e) => navigate({ owner: e.target.value || null, mine: null })}
            className={cn(LEAD_FIELD_CLASS, "h-9 w-auto min-w-[180px]")}
          >
            <option value="">{labels.filterAllOwners}</option>
            <option value="none">{labels.filterUnassigned}</option>
            {owners.map((o) => (
              <option key={o.email} value={o.email}>
                {o.label}
              </option>
            ))}
          </select>
        ) : null}

        {intents.length > 0 ? (
          <select
            aria-label={labels.intentLabel}
            data-testid="leads-intent-filter"
            value={current.intent}
            onChange={(e) => navigate({ intent: e.target.value || null })}
            className={cn(LEAD_FIELD_CLASS, "h-9 w-auto min-w-[180px]")}
          >
            <option value="">{labels.filterAllIntents}</option>
            {intents.map((i) => (
              <option key={i.key} value={i.key}>
                {i.label}
              </option>
            ))}
          </select>
        ) : null}

        {activeCount > 0 ? (
          <button
            type="button"
            data-testid="leads-clear-filters"
            onClick={clearAll}
            className={cn(CHIP, CHIP_OFF, "h-9 text-[var(--ink)]")}
          >
            <X className="size-3.5" aria-hidden />
            {labels.clearFilters}
            <span className="tabular-nums text-[11px] text-[var(--soft-ink)]">{activeCount}</span>
          </button>
        ) : null}

      </div>

      {current.view === "list" ? (
        <div role="group" aria-label={labels.columnStage} className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={current.stage === ""}
            onClick={() => navigate({ stage: null })}
            className={cn(CHIP, current.stage === "" ? CHIP_ON : CHIP_OFF)}
          >
            {labels.filterAllStages}
          </button>
          {stages.map((s) => (
            <button
              key={s.key}
              type="button"
              data-stage={s.key}
              aria-pressed={current.stage === s.key}
              onClick={() => navigate({ stage: s.key })}
              className={cn(CHIP, current.stage === s.key ? CHIP_ON : CHIP_OFF)}
            >
              {s.label}
              <span className="tabular-nums text-[11px] text-[var(--soft-ink)]">{s.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div role="group" aria-label={labels.pageTitle} className="flex flex-wrap gap-2">
        {showMine ? (
          <button
            type="button"
            aria-pressed={current.mine}
            onClick={() => navigate({ mine: current.mine ? null : "1", owner: null })}
            className={cn(CHIP, current.mine ? CHIP_ON : CHIP_OFF)}
          >
            {labels.filterMine}
          </button>
        ) : null}
        {quick.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={current.filter === f.key}
            onClick={() => navigate({ filter: current.filter === f.key ? null : f.key })}
            className={cn(CHIP, current.filter === f.key ? CHIP_ON : CHIP_OFF)}
          >
            {f.label}
          </button>
        ))}
        <span
          role="group"
          aria-label={labels.priority.filterLabel}
          className="flex flex-wrap gap-2 sm:ml-2 sm:border-l sm:border-[var(--rule)] sm:pl-4"
        >
          {priorityOptions(labels).map((p) => (
            <button
              key={p.key}
              type="button"
              data-priority={p.key}
              aria-pressed={current.priority === p.key}
              onClick={() => navigate({ priority: current.priority === p.key ? null : p.key })}
              className={cn(CHIP, current.priority === p.key ? CHIP_ON : CHIP_OFF)}
            >
              {p.label}
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}

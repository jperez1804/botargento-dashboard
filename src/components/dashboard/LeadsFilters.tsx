"use client";

// Filter bar for /leads. Everything lives in the URL (?stage=&owner=&filter=
// &mine=1&q=&view=) so views are shareable and survive refresh; defaults are
// omitted to keep URLs clean. The server does the filtering.

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutList, Search, SquareKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEAD_FIELD_CLASS } from "@/components/dashboard/lead-field-class";
import type { CrmLabels } from "@/config/verticals/_types";
import type { LeadListFilter } from "@/lib/queries/leads";

type Props = {
  labels: CrmLabels;
  stages: ReadonlyArray<{ key: string; label: string; count: number }>;
  owners: ReadonlyArray<{ email: string; label: string }>;
  current: {
    q: string;
    stage: string;
    owner: string;
    filter: LeadListFilter | "";
    mine: boolean;
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

export function LeadsFilters({ labels, stages, owners, current, showOwnerFilter, showMine }: Props) {
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

        <div
          role="group"
          aria-label={`${labels.viewList} / ${labels.viewBoard}`}
          className="ml-auto inline-flex rounded-lg border border-[var(--rule)] bg-[var(--canvas-2)] p-0.5"
        >
          {(["list", "board"] as const).map((v) => {
            const Icon = v === "list" ? LayoutList : SquareKanban;
            const active = current.view === v;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={active}
                onClick={() => navigate({ view: v === "list" ? null : v })}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12.5px] font-medium cursor-pointer transition-colors",
                  active
                    ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                    : "text-[var(--muted-ink)] hover:text-[var(--ink)]",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {v === "list" ? labels.viewList : labels.viewBoard}
              </button>
            );
          })}
        </div>
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
      </div>
    </div>
  );
}

"use client";

// Filter bar for the /inbox list: search + single-select quick-filter chips.
// State lives in the URL (?filter=unread&q=…) so views are deep-linkeable and
// the 30s InboxListPoller refresh preserves them; defaults (filter=all, empty
// q) are OMITTED to keep URLs clean. Server does the actual filtering.

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InboxFilter } from "@/lib/queries/inbox";

const CHIP_LABELS: Record<InboxFilter, string> = {
  all: "Todas",
  unread: "Sin leer",
  taken: "Tomadas",
  handoff: "Con derivación",
  window: "Ventana abierta",
};

const CHIP_ORDER: readonly InboxFilter[] = ["all", "unread", "taken", "handoff", "window"];

type Props = {
  activeFilter: InboxFilter;
  q: string;
  unreadTotal: number;
};

export function InboxFilters({ activeFilter, q, unreadTotal }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(q);
  const [prevQ, setPrevQ] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the input in sync when the URL q changes from outside (deep link,
  // back button) — the React-endorsed "adjust state during render" pattern.
  if (q !== prevQ) {
    setPrevQ(q);
    setSearch(q);
  }

  function navigate(nextFilter: InboxFilter, nextQ: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextFilter === "all") params.delete("filter");
    else params.set("filter", nextFilter);
    const trimmed = nextQ.trim();
    if (!trimmed) params.delete("q");
    else params.set("q", trimmed);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function onSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate(activeFilter, value), 300);
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-[420px]">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--soft-ink)]"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="Buscar conversaciones"
          placeholder="Buscar nombre o número…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          maxLength={80}
          className={cn(
            "w-full h-9 rounded-lg border border-[var(--rule)] bg-[var(--surface)] pl-9 pr-3",
            "text-[13.5px] text-[var(--ink)] placeholder:text-[var(--soft-ink)]",
            "focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)]",
          )}
        />
      </div>

      <div role="group" aria-label="Filtros rápidos" className="flex flex-wrap gap-2">
        {CHIP_ORDER.map((f) => {
          const active = f === activeFilter;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={active}
              onClick={() => navigate(f, search)}
              className={cn(
                "inline-flex items-center gap-1.5 h-[30px] px-3.5 rounded-full border text-[12.5px] font-medium",
                "cursor-pointer touch-manipulation transition-colors duration-150",
                "focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-2",
                active
                  ? "border-[color-mix(in_oklch,var(--client-primary)_55%,var(--rule))] bg-[color-mix(in_oklch,var(--client-primary)_12%,var(--surface))] text-[var(--ink)] font-semibold"
                  : "border-[var(--rule)] bg-[var(--canvas-2)] text-[var(--muted-ink)] hover:text-[var(--ink)] hover:border-[var(--rule-strong)]",
              )}
            >
              {CHIP_LABELS[f]}
              {f === "unread" && unreadTotal > 0 ? (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--client-primary)] text-[color-mix(in_oklch,var(--client-primary)_18%,black)] text-[10.5px] font-bold tabular-nums">
                  {unreadTotal}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// The last filter set used on /leads, remembered per browser so the board
// opens where the person left it. The URL stays the source of truth: the
// memory is only read when /leads is opened WITHOUT parameters, and
// "Limpiar filtros" forgets it. Only the filter keys are kept — never the
// search text or the page — and only for the views that have filters.

export const LEADS_FILTER_MEMORY_KEY = "botargento:leads-filters";

const PERSISTED_KEYS = [
  "view",
  "stage",
  "owner",
  "mine",
  "filter",
  "priority",
  "intent",
  "open",
  "group",
] as const;
const FILTERED_VIEWS = new Set(["board", "list"]);

/**
 * The part of a /leads query worth remembering, or null when the view has no
 * filters (Resumen, Actividad, Guía) — those visits leave the memory alone.
 */
export function rememberedLeadsQuery(params: URLSearchParams): string | null {
  const view = params.get("view") ?? "board";
  if (!FILTERED_VIEWS.has(view)) return null;
  const kept = new URLSearchParams();
  for (const key of PERSISTED_KEYS) {
    const value = params.get(key);
    if (value) kept.set(key, value);
  }
  return kept.toString();
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function saveLeadsFilters(params: URLSearchParams): void {
  const query = rememberedLeadsQuery(params);
  if (query === null) return;
  try {
    if (query) storage()?.setItem(LEADS_FILTER_MEMORY_KEY, query);
    else storage()?.removeItem(LEADS_FILTER_MEMORY_KEY);
  } catch {
    // Private mode / blocked storage: the URL still works on its own.
  }
}

export function loadLeadsFilters(): string | null {
  try {
    return storage()?.getItem(LEADS_FILTER_MEMORY_KEY) || null;
  } catch {
    return null;
  }
}

export function clearLeadsFilters(): void {
  try {
    storage()?.removeItem(LEADS_FILTER_MEMORY_KEY);
  } catch {
    // ignore
  }
}

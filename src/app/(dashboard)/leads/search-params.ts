// URL state of /leads: which view is open and the filters that apply to the
// board and the list. Parsed once per request; buildLeadsHref rebuilds a link
// that keeps the active filters (tabs, pagination).

import type { CrmConfig, CrmPriorityKey } from "@/config/verticals/_types";
import { parsePriority } from "@/lib/crm/priority";
import { LEAD_LIST_FILTERS, type LeadListFilter } from "@/lib/queries/leads";

export type LeadsView = "board" | "list" | "summary" | "activity" | "guide";

export type LeadsSearchParams = {
  view?: string;
  stage?: string;
  owner?: string;
  mine?: string;
  filter?: string;
  q?: string;
  page?: string;
  kind?: string;
  by?: string;
  priority?: string;
  intent?: string;
};

export type ParsedLeadsParams = {
  view: LeadsView;
  stage: string;
  filter: LeadListFilter | "";
  mine: boolean;
  owner: string; // Effective owner filter: the session email when `mine`.
  ownerParam: string; // The explicit ?owner= value, kept in links.
  q: string;
  priority: CrmPriorityKey | "";
  intent: string; // Vertical intent key, "" = all.
  pageNum: number;
  activityKind: string;
  activityBy: string;
};

const VIEWS: ReadonlyArray<LeadsView> = ["board", "list", "summary", "activity", "guide"];

// Views whose page has no lead filters of its own.
const FILTERLESS: ReadonlyArray<LeadsView> = ["summary", "activity", "guide"];

export function parseLeadsSearchParams(
  sp: LeadsSearchParams,
  crm: CrmConfig,
  sessionEmail: string,
  intentKeys: ReadonlyArray<string> = [],
): ParsedLeadsParams {
  // The board is the default view: it is how the team works the pipeline.
  const view = VIEWS.includes(sp.view as LeadsView) ? (sp.view as LeadsView) : "board";
  const mine = sp.mine === "1";
  const ownerParam = (sp.owner ?? "").trim().toLowerCase();
  return {
    view,
    stage: crm.stages.some((s) => s.key === sp.stage) ? String(sp.stage) : "",
    filter: LEAD_LIST_FILTERS.includes(sp.filter as LeadListFilter) ? (sp.filter as LeadListFilter) : "",
    mine,
    owner: mine ? sessionEmail : ownerParam,
    ownerParam,
    q: sp.q?.trim() ?? "",
    priority: parsePriority(sp.priority) ?? "",
    intent: sp.intent && intentKeys.includes(sp.intent) ? sp.intent : "",
    pageNum: Math.max(1, Number(sp.page) || 1),
    activityKind: sp.kind && sp.kind in crm.labels.eventKinds ? sp.kind : "",
    activityBy: (sp.by ?? "").trim().toLowerCase(),
  };
}

/**
 * Every link keeps the active filters, drops the page, and only spells out
 * the view when it is not the default one. Filterless views get a bare URL.
 */
export function buildLeadsHref(
  p: ParsedLeadsParams,
  overrides: { page?: number; view?: LeadsView } = {},
): string {
  const view = overrides.view ?? p.view;
  if (FILTERLESS.includes(view)) return `/leads?view=${view}`;
  const params = new URLSearchParams();
  if (view === "list") params.set("view", "list");
  if (p.stage) params.set("stage", p.stage);
  if (p.ownerParam && !p.mine) params.set("owner", p.ownerParam);
  if (p.mine) params.set("mine", "1");
  if (p.filter) params.set("filter", p.filter);
  if (p.priority) params.set("priority", p.priority);
  if (p.intent) params.set("intent", p.intent);
  if (p.q) params.set("q", p.q);
  if (overrides.page && overrides.page > 1) params.set("page", String(overrides.page));
  const qs = params.toString();
  return `/leads${qs ? `?${qs}` : ""}`;
}

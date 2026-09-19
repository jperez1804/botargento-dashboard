import { notFound } from "next/navigation";
import { tenantConfig } from "@/config/tenant";
import { crmConfig } from "@/lib/crm/enabled";
import { buildLeadView } from "@/lib/crm/view-model";
import { hasRole, requireRole } from "@/lib/role-guard";
import { LEAD_LIST_FILTERS, listLeads, type LeadListFilter } from "@/lib/queries/leads";
import { listTeam, memberLabel } from "@/lib/queries/team";
import { LeadsFilters } from "@/components/dashboard/LeadsFilters";
import { LeadsViewTabs } from "@/components/dashboard/LeadsViewTabs";
import { LeadsTable } from "@/components/dashboard/LeadsTable";
import { LeadsBoard, type BoardColumn } from "@/components/dashboard/LeadsBoard";
import { formatNumber } from "@/lib/format";

const PAGE_SIZE = 25;
// Board columns show the most recent cards; the header keeps the full count.
const BOARD_CARDS_PER_COLUMN = 50;
const BOARD_LOST_CARDS = 20;

type Props = {
  searchParams: Promise<{
    view?: string;
    stage?: string;
    owner?: string;
    mine?: string;
    filter?: string;
    q?: string;
    page?: string;
  }>;
};

export default async function LeadsPage({ searchParams }: Props) {
  const crm = crmConfig();
  if (!crm) notFound();
  const session = await requireRole("viewer");
  const sp = await searchParams;
  const labels = crm.labels;
  const tenant = tenantConfig();

  // The board is the default view: it is how the team works the pipeline.
  // The list stays one click away as ?view=list.
  const view = sp.view === "list" ? "list" : "board";
  const stage = crm.stages.some((s) => s.key === sp.stage) ? String(sp.stage) : "";
  const filter = LEAD_LIST_FILTERS.includes(sp.filter as LeadListFilter)
    ? (sp.filter as LeadListFilter)
    : "";
  const mine = sp.mine === "1";
  const owner = mine ? session.email : (sp.owner ?? "").trim().toLowerCase();
  const q = sp.q?.trim() ?? "";
  const pageNum = Math.max(1, Number(sp.page) || 1);
  const canEdit = hasRole(session, "asesor");

  const now = new Date();
  const [result, team] = await Promise.all([
    listLeads(
      crm,
      {
        stage: view === "list" ? stage || undefined : undefined,
        owner: owner || undefined,
        filter: filter || undefined,
        q: q || undefined,
        includeLost: view === "board",
      },
      now,
    ),
    listTeam(),
  ]);
  const labelFor = (email: string | null) => memberLabel(team, email);
  const views = result.rows.map((r) => ({
    waId: r.contactWaId,
    displayName: r.displayName,
    view: buildLeadView(r.lead, crm, labelFor, tenant.locale, tenant.timezone, now),
  }));

  // Shared query-string builder for pagination and the view tabs: every link
  // keeps the active filters, drops the page, and only spells out the view
  // when it is not the default one.
  const buildHref = (overrides: { page?: number; view?: "board" | "list" } = {}) => {
    const nextView = overrides.view ?? view;
    const params = new URLSearchParams();
    if (nextView === "list") params.set("view", "list");
    if (stage) params.set("stage", stage);
    if (sp.owner && !mine) params.set("owner", owner);
    if (mine) params.set("mine", "1");
    if (filter) params.set("filter", filter);
    if (q) params.set("q", q);
    if (overrides.page && overrides.page > 1) params.set("page", String(overrides.page));
    const qs = params.toString();
    return `/leads${qs ? `?${qs}` : ""}`;
  };
  const buildPageHref = (page: number) => buildHref({ page });

  const columns: BoardColumn[] = crm.stages.map((s) => {
    const inStage = views.filter((v) => v.view.stageKey === s.key);
    const cap = s.key === crm.autoStages.lost ? BOARD_LOST_CARDS : BOARD_CARDS_PER_COLUMN;
    return {
      key: s.key,
      label: s.label,
      tone: s.tone,
      total: inStage.length,
      cards: inStage.slice(0, cap).map((v) => ({
        waId: v.waId,
        displayName: v.displayName,
        stageKey: v.view.stageKey,
        auto: v.view.auto,
        ownerEmail: v.view.ownerEmail,
        ownerLabel: v.view.ownerLabel,
        statusText: v.view.statusText,
        statusTone: v.view.statusTone,
        reminderText:
          v.view.reminder && v.view.reminder.status !== "done" ? v.view.reminder.text : null,
        reminderOverdue: v.view.reminder?.status === "overdue",
        lastActivity: v.view.lastActivityRelative,
      })),
    };
  });

  const pageRows = views.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);
  // Owner filter lists everyone who can own a lead (including deactivated
  // people, whose old leads still need filtering); the board's assign menu
  // only offers the active ones.
  const owners = team
    .filter((m) => m.role !== "viewer")
    .map((m) => ({ email: m.email, label: m.displayName || m.email }));
  const members = team
    .filter((m) => m.role !== "viewer" && m.active)
    .map((m) => ({ email: m.email, label: m.displayName || m.email }));

  // In board view the board itself breaks out of the 1280px container (see
  // has-[[data-board-bleed]] in the dashboard layout); the masthead and the
  // filters stay centered, so they get their own wrapper.
  const headerWrapper = view === "board" ? "mx-auto w-full max-w-[1280px] space-y-6" : "space-y-6";

  return (
    <div className="space-y-6">
      <div className={headerWrapper}>
      <header className="space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)] font-[var(--font-geist-mono)]">
          {labels.pageKicker}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-[30px] leading-[1.1] tracking-[-0.025em] text-[var(--ink)] font-semibold">
            {labels.pageTitle}
          </h1>
          <p className="text-[13px] text-[var(--muted-ink)] tabular-nums">
            {formatNumber(views.length, tenant.locale)}
          </p>
        </div>
        <LeadsViewTabs
          label={labels.pageTitle}
          tabs={[
            {
              key: "board",
              label: labels.viewBoard,
              href: buildHref({ view: "board" }),
              active: view === "board",
            },
            {
              key: "list",
              label: labels.viewList,
              href: buildHref({ view: "list" }),
              active: view === "list",
            },
          ]}
        />
      </header>

      <LeadsFilters
        labels={labels}
        stages={crm.stages.map((s) => ({
          key: s.key,
          label: s.label,
          count: result.stageCounts[s.key] ?? 0,
        }))}
        owners={owners}
        current={{ q, stage, owner: mine ? "" : owner, filter, mine, view }}
        showOwnerFilter
        showMine={canEdit}
      />
      </div>

      {view === "board" ? (
        <LeadsBoard
          columns={columns}
          members={members}
          labels={labels}
          canEdit={canEdit}
          isAdmin={session.role === "admin"}
          sessionEmail={session.email}
        />
      ) : (
        <LeadsTable
          rows={pageRows}
          labels={labels}
          pagination={{
            page: pageNum,
            pageSize: PAGE_SIZE,
            total: views.length,
            buildPageHref,
            locale: tenant.locale,
          }}
        />
      )}
    </div>
  );
}

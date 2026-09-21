import { notFound } from "next/navigation";
import { tenantConfig } from "@/config/tenant";
import { crmConfig } from "@/lib/crm/enabled";
import { buildLeadView, sumBudgets } from "@/lib/crm/view-model";
import { hasRole, requireRole } from "@/lib/role-guard";
import { LEAD_LIST_FILTERS, listLeads, type LeadListFilter } from "@/lib/queries/leads";
import { listTeam, memberLabel } from "@/lib/queries/team";
import { LeadsFilters } from "@/components/dashboard/LeadsFilters";
import { LeadsViewTabs } from "@/components/dashboard/LeadsViewTabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { LeadsTable } from "@/components/dashboard/LeadsTable";
import { LeadsBoard, type BoardColumn } from "@/components/dashboard/LeadsBoard";
import { NewLeadDialog } from "@/components/dashboard/NewLeadDialog";
import { TeamActivityFeed } from "@/components/dashboard/TeamActivityFeed";
import { TeamActivityFilters } from "@/components/dashboard/TeamActivityFilters";
import { listTeamLeadEvents } from "@/lib/queries/lead-detail";
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
    kind?: string;
    by?: string;
  }>;
};

type LeadsView = "board" | "list" | "activity";

export default async function LeadsPage({ searchParams }: Props) {
  const crm = crmConfig();
  if (!crm) notFound();
  const session = await requireRole("viewer");
  const sp = await searchParams;
  const labels = crm.labels;
  const tenant = tenantConfig();

  // The board is the default view: it is how the team works the pipeline.
  // The list and the team's activity feed are one tab away.
  const view: LeadsView = sp.view === "list" || sp.view === "activity" ? sp.view : "board";
  const activityKind = sp.kind && sp.kind in labels.eventKinds ? sp.kind : "";
  const activityBy = (sp.by ?? "").trim().toLowerCase();
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
  const [result, team, events] = await Promise.all([
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
    view === "activity"
      ? listTeamLeadEvents({ kind: activityKind || undefined, by: activityBy || undefined })
      : Promise.resolve([]),
  ]);
  const labelFor = (email: string | null) => memberLabel(team, email);
  const sourceLabel = (key: string) =>
    crm.manualLeadSources.find((s) => s.key === key)?.label ?? key;
  const views = result.rows.map((r) => ({
    waId: r.contactWaId,
    displayName: r.displayName,
    budget: r.budget,
    // Only leads registered by hand show an origin; WhatsApp is the default.
    sourceLabel: r.manual ? sourceLabel(r.manual.source) : null,
    view: buildLeadView(r.lead, crm, labelFor, tenant.locale, tenant.timezone, now, r.budget),
  }));

  // Shared query-string builder for pagination and the view tabs: every link
  // keeps the active filters, drops the page, and only spells out the view
  // when it is not the default one.
  const buildHref = (overrides: { page?: number; view?: LeadsView } = {}) => {
    const nextView = overrides.view ?? view;
    // The activity feed has its own filters; the lead filters don't apply.
    if (nextView === "activity") return "/leads?view=activity";
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
      budgetTotal: sumBudgets(
        inStage.map((v) => v.budget),
        tenant.locale,
      ),
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
        budgetText: v.view.budgetText,
        daysInStage: v.view.daysInStageText,
        sourceLabel: v.sourceLabel,
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
  // has-[[data-board-bleed]] in the dashboard layout). The masthead and filters
  // keep the 1280px reading width but start at the SAME left edge as the first
  // board column — no mx-auto, which would centre them in the widened container
  // and leave the title floating away from the board.
  const headerWrapper = view === "board" ? "w-full max-w-[1280px] space-y-6" : "space-y-6";

  return (
    <div className="space-y-6">
      <div className={headerWrapper}>
      <PageHeader
        kicker={labels.pageKicker}
        title={labels.pageTitle}
        meta={
          <span className="tabular-nums">
            {formatNumber(views.length, tenant.locale)} {labels.nav.toLowerCase()}
          </span>
        }
        actions={
          canEdit && crm.manualLeadSources.length > 0 ? (
            <NewLeadDialog labels={labels} sources={crm.manualLeadSources} />
          ) : null
        }
        divider={false}
      >
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
            {
              key: "activity",
              label: labels.viewActivity,
              href: buildHref({ view: "activity" }),
              active: view === "activity",
            },
          ]}
        />
      </PageHeader>

      {view === "activity" ? (
        <TeamActivityFilters
          labels={labels}
          kinds={Object.entries(labels.eventKinds).map(([key, label]) => ({ key, label }))}
          people={team.map((m) => ({ email: m.email, label: m.displayName || m.email }))}
          current={{ kind: activityKind, by: activityBy }}
        />
      ) : (
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
      )}
      </div>

      {view === "activity" ? (
        <TeamActivityFeed
          events={events}
          config={crm}
          memberLabel={labelFor}
          locale={tenant.locale}
          timezone={tenant.timezone}
        />
      ) : view === "board" ? (
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

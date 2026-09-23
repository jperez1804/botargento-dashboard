import { notFound } from "next/navigation";
import { tenantConfig } from "@/config/tenant";
import { verticalConfig } from "@/config/verticals";
import { intentOptions, leadIntent } from "@/lib/crm/intent";
import { crmConfig } from "@/lib/crm/enabled";
import { buildLeadView } from "@/lib/crm/view-model";
import { buildLeadsSummary, closedStageKeys } from "@/lib/crm/summary";
import { leadAttention } from "@/lib/crm/attention";
import { hasRole, requireRole } from "@/lib/role-guard";
import { listLeads, type ListLeadsResult } from "@/lib/queries/leads";
import { listTeam, memberLabel } from "@/lib/queries/team";
import { listTeamLeadEvents } from "@/lib/queries/lead-detail";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { LeadsFilters } from "@/components/dashboard/LeadsFilters";
import { LeadsViewTabs } from "@/components/dashboard/LeadsViewTabs";
import { LeadsTable } from "@/components/dashboard/LeadsTable";
import { LeadsBoard } from "@/components/dashboard/LeadsBoard";
import { LeadsSummary } from "@/components/dashboard/LeadsSummary";
import { LeadsGuide } from "@/components/dashboard/LeadsGuide";
import { NewLeadDialog } from "@/components/dashboard/NewLeadDialog";
import { TeamActivityFeed } from "@/components/dashboard/TeamActivityFeed";
import { TeamActivityFilters } from "@/components/dashboard/TeamActivityFilters";
import { buildBoardColumns, type LeadViewRow } from "./board-columns";
import {
  buildLeadsHref,
  parseLeadsSearchParams,
  type LeadsSearchParams,
  type LeadsView,
} from "./search-params";

const PAGE_SIZE = 25;

type Props = { searchParams: Promise<LeadsSearchParams> };

const EMPTY: ListLeadsResult = { rows: [], stageCounts: {}, todayCount: 0 };

export default async function LeadsPage({ searchParams }: Props) {
  const crm = crmConfig();
  if (!crm) notFound();
  const session = await requireRole("viewer");
  const sp = await searchParams;
  const labels = crm.labels;
  const tenant = tenantConfig();
  const intents = verticalConfig().intents;
  const p = parseLeadsSearchParams(sp, crm, session.email, intents.map((i) => i.key));
  const { view } = p;
  const canEdit = hasRole(session, "asesor");

  const now = new Date();
  const [result, team, events] = await Promise.all([
    view === "guide"
      ? Promise.resolve(EMPTY)
      : view === "summary"
        ? // The summary describes the whole pipeline: no user filters, lost included.
          listLeads(crm, { includeLost: true }, now)
        : listLeads(
            crm,
            {
              stage: view === "list" ? p.stage || undefined : undefined,
              owner: p.owner || undefined,
              filter: p.filter || undefined,
              priority: p.priority || undefined,
              intent: p.intent || undefined,
              q: p.q || undefined,
              includeLost: view === "board",
              viewer: { email: session.email, isAdmin: session.role === "admin" },
            },
            now,
          ),
    listTeam(),
    view === "activity"
      ? listTeamLeadEvents({ kind: p.activityKind || undefined, by: p.activityBy || undefined })
      : Promise.resolve([]),
  ]);
  const labelFor = (email: string | null) => memberLabel(team, email);
  const sourceLabel = (key: string) =>
    crm.manualLeadSources.find((s) => s.key === key)?.label ?? key;
  const views: LeadViewRow[] = result.rows.map((r) => ({
    waId: r.contactWaId,
    displayName: r.displayName,
    budget: r.budget,
    // Every lead shows where it came from: the origin picked when it was
    // registered by hand (kept even after the person writes on WhatsApp),
    // otherwise WhatsApp.
    sourceLabel: r.manual ? sourceLabel(r.manual.source) : labels.sourceWhatsapp,
    intentLabel: leadIntent(r.lastIntent, intents)?.label ?? null,
    attention: leadAttention(r.lead, labels, tenant.locale, tenant.timezone, now),
    view: buildLeadView(r.lead, crm, labelFor, tenant.locale, tenant.timezone, now, r.budget),
  }));

  const buildHref = (overrides: { page?: number; view?: LeadsView } = {}) =>
    buildLeadsHref(p, overrides);
  const columns =
    view === "board"
      ? buildBoardColumns(views, crm, tenant.locale, (stage) => buildLeadsHref({ ...p, stage }, { view: "list" }))
      : [];
  const summary = view === "summary" ? buildLeadsSummary(result.rows, crm, team, now) : null;
  const closedKey = closedStageKeys(crm)[0];

  const pageRows = views.slice((p.pageNum - 1) * PAGE_SIZE, p.pageNum * PAGE_SIZE);
  // Owner filter lists everyone who can own a lead (including deactivated
  // people, whose old leads still need filtering); the board's assign menu
  // only offers the active ones.
  const owners = team
    .filter((m) => m.role !== "viewer")
    .map((m) => ({ email: m.email, label: m.displayName || m.email }));
  const members = team
    .filter((m) => m.role !== "viewer" && m.active)
    .map((m) => ({ email: m.email, label: m.displayName || m.email }));

  const tabs: ReadonlyArray<{ key: LeadsView; label: string }> = [
    { key: "board", label: labels.viewBoard },
    { key: "list", label: labels.viewList },
    { key: "summary", label: labels.summary.view },
    { key: "activity", label: labels.viewActivity },
    { key: "guide", label: labels.guide.view },
  ];

  // Every Leads view breaks out of the 1280px container (has-[[data-board-bleed]]
  // in the dashboard layout) and uses the whole width. The masthead, filters,
  // summary and guide keep a reading width but start at the SAME left edge as
  // the content — no mx-auto, which would centre them in the widened container.
  return (
    <div data-board-bleed className="space-y-6">
      <div className="w-full max-w-[1280px] space-y-6">
        <PageHeader
          kicker={labels.pageKicker}
          title={labels.pageTitle}
          meta={
            view === "guide" ? null : (
              <span className="tabular-nums">
                {formatNumber(views.length, tenant.locale)} {labels.nav.toLowerCase()}
              </span>
            )
          }
          actions={
            canEdit && crm.manualLeadSources.length > 0 ? (
              <NewLeadDialog labels={labels} sources={crm.manualLeadSources} intents={intentOptions(intents)} />
            ) : null
          }
          divider={false}
        >
          <LeadsViewTabs
            label={labels.pageTitle}
            tabs={tabs.map((t) => ({
              key: t.key,
              label: t.label,
              href: buildHref({ view: t.key }),
              active: view === t.key,
            }))}
          />
        </PageHeader>

        {view === "activity" ? (
          <TeamActivityFilters
            labels={labels}
            kinds={Object.entries(labels.eventKinds).map(([key, label]) => ({ key, label }))}
            people={team.map((m) => ({ email: m.email, label: m.displayName || m.email }))}
            current={{ kind: p.activityKind, by: p.activityBy }}
          />
        ) : view === "board" || view === "list" ? (
          <LeadsFilters
            labels={labels}
            stages={crm.stages.map((s) => ({
              key: s.key,
              label: s.label,
              count: result.stageCounts[s.key] ?? 0,
            }))}
            owners={owners}
            intents={intentOptions(intents)}
            todayCount={result.todayCount}
            current={{
              q: p.q,
              stage: p.stage,
              owner: p.mine ? "" : p.owner,
              filter: p.filter,
              mine: p.mine,
              priority: p.priority,
              intent: p.intent,
              view,
            }}
            showOwnerFilter
            showMine={canEdit}
          />
        ) : null}
      </div>

      {view === "guide" ? (
        <LeadsGuide config={crm} />
      ) : view === "summary" && summary ? (
        <LeadsSummary
          summary={summary}
          labels={labels}
          locale={tenant.locale}
          closedHref={closedKey ? `/leads?view=list&stage=${encodeURIComponent(closedKey)}` : null}
          dueSoonHref="/follow-up"
        />
      ) : view === "activity" ? (
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
          lostKey={crm.autoStages.lost}
          openKeys={p.open}
          filtersActive={Boolean(p.q || p.owner || p.filter || p.priority || p.intent || p.mine)}
          clearHref="/leads"
        />
      ) : (
        <LeadsTable
          rows={pageRows}
          labels={labels}
          pagination={{
            page: p.pageNum,
            pageSize: PAGE_SIZE,
            total: views.length,
            buildPageHref: (page) => buildHref({ page }),
            locale: tenant.locale,
          }}
        />
      )}
    </div>
  );
}

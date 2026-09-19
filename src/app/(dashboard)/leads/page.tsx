import { notFound } from "next/navigation";
import { tenantConfig } from "@/config/tenant";
import { crmConfig } from "@/lib/crm/enabled";
import { buildLeadView } from "@/lib/crm/view-model";
import { hasRole, requireRole } from "@/lib/role-guard";
import { LEAD_LIST_FILTERS, listLeads, type LeadListFilter } from "@/lib/queries/leads";
import { listTeam, memberLabel } from "@/lib/queries/team";
import { LeadsFilters } from "@/components/dashboard/LeadsFilters";
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

  const view = sp.view === "board" ? "board" : "list";
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
    view: buildLeadView(r.lead, crm, labelFor, tenant.locale, tenant.timezone),
  }));

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams();
    if (stage) params.set("stage", stage);
    if (sp.owner && !mine) params.set("owner", owner);
    if (mine) params.set("mine", "1");
    if (filter) params.set("filter", filter);
    if (q) params.set("q", q);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/leads${qs ? `?${qs}` : ""}`;
  };

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
        ownerLabel: v.view.ownerLabel,
        hasOwner: v.view.ownerEmail !== null,
        statusText: v.view.statusText,
        statusTone: v.view.statusTone,
        reminderText:
          v.view.reminder && v.view.reminder.status !== "done" ? v.view.reminder.text : null,
        reminderOverdue: v.view.reminder?.status === "overdue",
      })),
    };
  });

  const pageRows = views.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);
  const owners = team
    .filter((m) => m.role !== "viewer")
    .map((m) => ({ email: m.email, label: m.displayName || m.email }));

  return (
    <div className="space-y-6">
      <header className="space-y-3 border-b border-[var(--rule)] pb-5">
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

      {view === "board" ? (
        <LeadsBoard columns={columns} labels={labels} canEdit={canEdit} />
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

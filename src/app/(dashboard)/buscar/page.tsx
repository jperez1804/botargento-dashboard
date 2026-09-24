import { Search } from "lucide-react";
import { tenantConfig } from "@/config/tenant";
import { SEARCH_LABELS as L } from "@/config/search-labels";
import { crmConfig } from "@/lib/crm/enabled";
import { buildLeadView, fillTemplate, formatDayTime } from "@/lib/crm/view-model";
import { groupByPerson, listLeads } from "@/lib/queries/leads";
import { listContacts } from "@/lib/queries/contacts";
import { listTeam, memberLabel } from "@/lib/queries/team";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/dashboard/DataTable";
import { LeadStageChip } from "@/components/dashboard/LeadStageChip";
import type { CrmStageTone } from "@/config/verticals/_types";

const MAX_RESULTS = 50;

type Props = { searchParams: Promise<{ q?: string }> };

type Stage = { label: string; tone: CrmStageTone; auto: boolean };

type Result = {
  waId: string;
  name: string;
  sourceLabel: string | null;
  // One chip per opportunity the person has: a rental in Visita and a sale in
  // Calificado are two chips on the same row.
  stages: Stage[];
  lastActivity: string;
};

/**
 * Global search (header field → /buscar?q=). With a CRM it searches leads —
 * WhatsApp contacts and leads registered by hand, lost ones included — so each
 * result shows its stage; without one it searches conversations. Both reuse
 * the existing list queries (name or phone, case-insensitive).
 */
export default async function SearchPage({ searchParams }: Props) {
  const { q: raw } = await searchParams;
  const q = (raw ?? "").trim().slice(0, 80);
  const tenant = tenantConfig();
  const crm = crmConfig();
  const now = new Date();

  let results: Result[] = [];
  if (q && crm) {
    const [leads, team] = await Promise.all([listLeads(crm, { q, includeLost: true }, now), listTeam()]);
    const labelFor = (email: string | null) => memberLabel(team, email);
    results = groupByPerson(leads.rows)
      .slice(0, MAX_RESULTS)
      .map((group) => {
        const views = group.rows.map((r) =>
          buildLeadView(r.lead, crm, labelFor, tenant.locale, tenant.timezone, now, r.budget),
        );
        const first = group.rows[0]!;
        return {
          waId: group.contactWaId,
          name: group.displayName,
          sourceLabel:
            first.contact.source === "whatsapp"
              ? crm.labels.sourceWhatsapp
              : (crm.manualLeadSources.find((s) => s.key === first.contact.source)?.label ??
                first.contact.source),
          stages: views.map((v) => ({ label: v.stageLabel, tone: v.tone, auto: v.auto })),
          lastActivity: views[0]!.lastActivityText,
        };
      });
  } else if (q) {
    const contacts = await listContacts({ search: q, limit: MAX_RESULTS });
    results = contacts.map((c) => ({
      waId: c.contactWaId,
      name: c.displayName ?? c.contactWaId,
      sourceLabel: null,
      stages: [],
      lastActivity: formatDayTime(new Date(c.lastSeen), tenant.locale, tenant.timezone),
    }));
  }

  const columns: DataTableColumn<Result>[] = [
    {
      id: "contact",
      header: L.columnContact,
      width: "minmax(0,1.6fr)",
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.name}</p>
          <p className="font-[var(--font-geist-mono)] text-[12px] tabular-nums text-[var(--soft-ink)]">
            {r.waId}
            {r.sourceLabel ? (
              <span className="ml-2 font-[var(--font-geist-sans)] text-[var(--muted-ink)]">· {r.sourceLabel}</span>
            ) : null}
          </p>
        </div>
      ),
    },
    ...(crm
      ? [
          {
            id: "stage",
            header: L.columnStage,
            width: "minmax(150px, 0.9fr)",
            cell: (r: Result) =>
              r.stages.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {r.stages.map((s, i) => (
                    <LeadStageChip
                      key={`${i}-${s.label}`}
                      label={s.label}
                      tone={s.tone}
                      auto={s.auto}
                      autoTitle={crm.labels.autoStageDetail}
                    />
                  ))}
                </span>
              ) : null,
          },
        ]
      : []),
    {
      id: "activity",
      header: L.columnLastActivity,
      width: "minmax(0,1fr)",
      cell: (r) => <span className="tabular-nums text-[var(--muted-ink)]">{r.lastActivity}</span>,
    },
  ];

  const meta = !q
    ? L.promptEmpty
    : fillTemplate(results.length === 1 ? L.resultsOneTemplate : L.resultsTemplate, {
        n: results.length,
        q,
      });

  return (
    <div className="space-y-6">
      <PageHeader kicker={L.kicker} title={L.title} meta={<span data-testid="search-meta">{meta}</span>} />
      {q ? (
        <DataTable
          columns={columns}
          rows={results}
          rowKey={(r) => r.waId}
          rowHref={(r) => `/conversations/${encodeURIComponent(r.waId)}`}
          rowAriaLabel={(r) => `${L.rowAriaPrefix} ${r.name}`}
          empty={{
            icon: <Search className="size-5" aria-hidden />,
            title: fillTemplate(L.emptyTemplate, { q }),
          }}
          minWidth={640}
        />
      ) : null}
    </div>
  );
}

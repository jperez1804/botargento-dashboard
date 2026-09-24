// Intercepted /leads/[waId]: the lead's full card inside the modal, over the
// board. Mirrors conversations/[waId]/page.tsx minus the chat. Not a lead →
// redirect to the conversation (notFound() would draw the 404 inside the slot).

import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, MessageCircle, X } from "lucide-react";
import { tenantConfig } from "@/config/tenant";
import { verticalConfig } from "@/config/verticals";
import { crmConfig } from "@/lib/crm/enabled";
import { buildLeadView, fillTemplate } from "@/lib/crm/view-model";
import { leadIntent } from "@/lib/crm/intent";
import { getSessionRole, hasRole } from "@/lib/role-guard";
import { getOpportunity } from "@/lib/queries/leads";
import { getLeadQualification, listOpportunityEvents } from "@/lib/queries/lead-detail";
import { listTeam, memberLabel } from "@/lib/queries/team";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogTitle } from "@/components/ui/dialog";
import { LeadCrmCard } from "@/components/dashboard/LeadCrmCard";
import { LeadActivityFeed } from "@/components/dashboard/LeadActivityFeed";
import { LeadQualificationCard } from "@/components/dashboard/LeadQualificationCard";
import { LeadStageChip } from "@/components/dashboard/LeadStageChip";
import { LeadPriorityChip } from "@/components/dashboard/LeadPriorityChip";
import { RefreshOnce } from "@/components/dashboard/RefreshOnce";

type Props = {
  params: Promise<{ id: string }>;
  // ?edit=reminder opens the "Próximo paso" editor (Nuevo lead lands here).
  searchParams: Promise<{ edit?: string | string[] }>;
};

const CHIP =
  "inline-flex h-[22px] items-center rounded-full border border-[var(--rule)] px-2 text-[11.5px] text-[var(--muted-ink)]";

export default async function LeadModalPage({ params, searchParams }: Props) {
  const [{ id }, { edit }] = await Promise.all([params, searchParams]);
  const initialField = edit === "reminder" ? ("reminder" as const) : undefined;
  const crm = crmConfig();
  const session = await getSessionRole();
  if (!crm || !session) return null;
  const now = new Date();
  const lead = await getOpportunity(crm, Number(id), now);
  if (!lead) redirect("/leads");
  const waId = lead.contactWaId;
  const [events, qualification, team] = await Promise.all([
    listOpportunityEvents(lead.id, waId),
    getLeadQualification(crm, lead),
    listTeam(),
  ]);

  const tenant = tenantConfig();
  const labels = crm.labels;
  const labelFor = (email: string | null) => memberLabel(team, email);
  const canEdit = hasRole(session, "asesor");
  const members = team
    .filter((m) => m.role !== "viewer" && m.active)
    .map((m) => ({ email: m.email, label: m.displayName || m.email }));
  const view = buildLeadView(lead.lead, crm, labelFor, tenant.locale, tenant.timezone, now, lead.budget);
  const intent = leadIntent(lead.kind, verticalConfig().intents);
  const sourceLabel =
    lead.contact.source === "whatsapp"
      ? labels.sourceWhatsapp
      : (crm.manualLeadSources.find((s) => s.key === lead.contact.source)?.label ??
        lead.contact.source);
  const conversationHref = `/conversations/${encodeURIComponent(waId)}?op=${lead.id}`;

  return (
    <div className="flex max-h-[calc(100dvh-3rem)] flex-col">
      {/* Opened right after "Nuevo lead": the board behind predates the lead. */}
      {initialField ? <RefreshOnce /> : null}
      <header className="flex items-center gap-3 border-b border-[var(--rule)] px-5 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)]">
            {labels.pageTitle}
          </span>
          <LeadStageChip label={view.stageLabel} tone={view.tone} auto={view.auto} autoTitle={labels.autoStageDetail} />
          {view.priority ? <LeadPriorityChip label={view.priority.label} tone={view.priority.tone} /> : null}
          {intent ? (
            <span data-testid="lead-intent" className={CHIP}>
              {intent.label}
            </span>
          ) : null}
          {lead.ofTotal > 1 ? (
            <span data-testid="lead-of-total" className={CHIP} title={labels.opportunity.listTitle}>
              {fillTemplate(labels.opportunity.ofTotalTemplate, { n: lead.seq, total: lead.ofTotal })}
            </span>
          ) : null}
          <span className={CHIP}>{sourceLabel}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={conversationHref} />}
          className="shrink-0"
          data-testid="lead-open-conversation"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          {labels.openConversation}
        </Button>
        <DialogClose
          aria-label={labels.close}
          render={<Button variant="ghost" size="icon-sm" className="shrink-0" />}
        >
          <X className="size-4" aria-hidden />
        </DialogClose>
      </header>

      <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="order-2 min-w-0 space-y-4 lg:order-1">
          <div className="space-y-1">
            <DialogTitle className="text-[22px] font-semibold tracking-[-0.02em] leading-[1.15] text-[var(--ink)]">
              {lead.displayName}
            </DialogTitle>
            {lead.title ? (
              <p className="text-[13px] text-[var(--muted-ink)]">{lead.title}</p>
            ) : null}
            <a
              href={`https://wa.me/${encodeURIComponent(waId)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-[var(--font-geist-mono)] text-[12.5px] tabular-nums text-[var(--soft-ink)] hover:text-[var(--ink)] hover:underline underline-offset-2"
            >
              <MessageCircle className="size-3" aria-hidden />
              {waId}
            </a>
          </div>
          <LeadQualificationCard
            title={labels.qualificationTitle}
            items={qualification}
            locale={tenant.locale}
            labels={labels}
          />
          <LeadActivityFeed
            waId={waId}
            opportunityId={lead.id}
            events={events}
            config={crm}
            memberLabel={labelFor}
            canEdit={canEdit}
            locale={tenant.locale}
            timezone={tenant.timezone}
            stageKey={view.stageKey}
          />
        </section>
        <aside className="order-1 lg:order-2">
          <LeadCrmCard
            waId={waId}
            kind={lead.kind}
            intents={verticalConfig().intents}
            opportunityId={lead.id}
            view={view}
            config={crm}
            members={members}
            sessionEmail={session.email}
            isAdmin={session.role === "admin"}
            canEdit={canEdit}
            initialField={initialField}
          />
        </aside>
      </div>
    </div>
  );
}

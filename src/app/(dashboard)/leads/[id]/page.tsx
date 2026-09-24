import { notFound, redirect } from "next/navigation";
import { crmConfig } from "@/lib/crm/enabled";
import { getOpportunity } from "@/lib/queries/leads";

// /leads/[id] is only ever a modal over the board (intercepted from an in-app
// navigation). A hard load, a new tab or a shared link lands here instead, and
// the person's page — with this opportunity selected — is the right place for
// it.
export default async function LeadFullPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const crm = crmConfig();
  if (!crm) notFound();

  const opportunity = await getOpportunity(crm, Number(id), new Date());
  if (!opportunity) notFound();

  redirect(`/conversations/${encodeURIComponent(opportunity.contactWaId)}?op=${opportunity.id}`);
}

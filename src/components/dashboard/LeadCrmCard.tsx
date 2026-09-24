// The CRM card on /conversations/[waId] and in the board modal: owner, next
// step, stage, priority and budget as a Jira-style "Details" list with
// inline editing (LeadDetails). Server Component: it only derives the props
// from the LeadView and the vertical config; viewers get the same list
// without editors.

import { Card, CardContent } from "@/components/ui/card";
import { LeadDetails, type LeadDetailField } from "@/components/dashboard/LeadDetails";
import { LEAD_CAPTION_CLASS } from "@/components/dashboard/lead-field-class";
import { crmCurrencies } from "@/lib/crm/budget";
import type { CrmConfig } from "@/config/verticals/_types";
import type { LeadView } from "@/lib/crm/view-model";

type Props = {
  waId: string;
  // The opportunity every write in this card acts on.
  opportunityId: number;
  view: LeadView;
  config: CrmConfig;
  members: ReadonlyArray<{ email: string; label: string }>;
  sessionEmail: string;
  isAdmin: boolean;
  canEdit: boolean;
  initialField?: LeadDetailField;
};

export function LeadCrmCard({
  waId,
  opportunityId,
  view,
  config,
  members,
  sessionEmail,
  isAdmin,
  canEdit,
  initialField,
}: Props) {
  return (
    <Card data-testid="lead-crm-card">
      <CardContent className="space-y-3 px-4 py-4">
        <p className={LEAD_CAPTION_CLASS}>{config.labels.cardTitle}</p>
        <LeadDetails
          waId={waId}
          opportunityId={opportunityId}
          view={view}
          labels={config.labels}
          stages={config.stages.map((s) => ({ key: s.key, label: s.label }))}
          lostKey={config.autoStages.lost}
          currencies={crmCurrencies(config)}
          members={members}
          sessionEmail={sessionEmail}
          isAdmin={isAdmin}
          canEdit={canEdit}
          initialField={initialField}
        />
      </CardContent>
    </Card>
  );
}

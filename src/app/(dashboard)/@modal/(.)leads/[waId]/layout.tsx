// One Dialog instance for the intercepted lead route, shared by loading.tsx
// (skeleton) and page.tsx (content) so the backdrop doesn't re-animate when
// the data arrives.

import { crmConfig } from "@/lib/crm/enabled";
import { LeadDetailModal } from "@/components/dashboard/LeadDetailModal";

export default function LeadModalLayout({ children }: { children: React.ReactNode }) {
  const crm = crmConfig();
  if (!crm) return null;
  return <LeadDetailModal ariaLabel={crm.labels.cardTitle}>{children}</LeadDetailModal>;
}

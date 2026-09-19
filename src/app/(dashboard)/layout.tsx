import { auth } from "@/lib/auth";
import { verticalConfig } from "@/config/verticals";
import { getSessionRole } from "@/lib/role-guard";
import { inboxEnabled } from "@/lib/inbox";
import { crmConfig } from "@/lib/crm/enabled";
import { getCrmAlerts, type CrmAlerts } from "@/lib/queries/leads";
import { logger } from "@/lib/logger";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { CrmAlertBanner } from "@/components/layout/CrmAlertBanner";
import type { NavItemDef } from "@/config/verticals/_types";

const SETTINGS_NAV_ITEM: NavItemDef = {
  href: "/settings",
  label: "Configuración",
  icon: "settings",
};

const PROVIDERS_NAV_ITEM: NavItemDef = {
  href: "/providers",
  label: "Proveedores",
  icon: "providers",
};

const LABOR_POOL_NAV_ITEM: NavItemDef = {
  href: "/labor-pool",
  label: "Mano de obra",
  icon: "labor-pool",
};

const CAMPAIGNS_NAV_ITEM: NavItemDef = {
  href: "/campaigns",
  label: "Campañas",
  icon: "campaigns",
};

const INBOX_NAV_ITEM: NavItemDef = {
  href: "/inbox",
  label: "Inbox",
  icon: "inbox",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // The /proxy.ts guard already redirects unauthenticated requests, so this
  // session() call is a safe source of truth for user-facing chrome.
  const session = await auth();
  const vertical = verticalConfig();

  // Hide the Settings nav for viewers — server-side gate prevents the 403
  // click. The /settings page itself still calls requireRole("admin") so
  // direct URL access by a viewer redirects to /.
  const sessionRole = await getSessionRole();
  const crm = crmConfig();
  // CRM-lite: visible to every role (viewers read, asesor/admin edit).
  const leadsItems: NavItemDef[] = crm
    ? [{ href: "/leads", label: crm.labels.nav, icon: "leads" }]
    : [];
  const featureItems: NavItemDef[] = [
    ...leadsItems,
    ...(vertical.features?.providersTab ? [PROVIDERS_NAV_ITEM] : []),
    ...(vertical.features?.laborPoolTab ? [LABOR_POOL_NAV_ITEM] : []),
    ...(vertical.features?.campaignsTab ? [CAMPAIGNS_NAV_ITEM] : []),
  ];
  // Inbox is admin-only AND tenant-gated (vertical capability + webhook env) —
  // viewers and non-inbox tenants never see the tab.
  const adminFeatureItems: NavItemDef[] = inboxEnabled() ? [INBOX_NAV_ITEM] : [];
  const navItems: ReadonlyArray<NavItemDef> =
    sessionRole?.role === "admin"
      ? [...vertical.nav, ...featureItems, ...adminFeatureItems, SETTINGS_NAV_ITEM]
      : [...vertical.nav, ...featureItems];

  // "Leads por vencer / recordatorios vencidos" strip, recomputed on every
  // navigation or refresh. Admins see the whole team's counts, an asesor only
  // their own leads; viewers own nothing, so they never see it. A failure here
  // must never take the whole dashboard down.
  let alerts: CrmAlerts | null = null;
  if (crm && sessionRole && sessionRole.role !== "viewer") {
    try {
      alerts = await getCrmAlerts(
        crm,
        sessionRole.role === "admin" ? null : sessionRole.email,
        new Date(),
      );
    } catch (err) {
      logger.warn({ err }, "CRM alerts failed");
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header userEmail={session?.user?.email} navItems={navItems} />
      {crm && alerts ? (
        <CrmAlertBanner
          alerts={alerts}
          labels={crm.labels}
          scopeMine={sessionRole?.role !== "admin"}
        />
      ) : null}
      <div className="flex-1 flex min-h-0">
        <Sidebar items={navItems} />
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

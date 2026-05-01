import { auth } from "@/lib/auth";
import { verticalConfig } from "@/config/verticals";
import { getSessionRole } from "@/lib/role-guard";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import type { NavItemDef } from "@/config/verticals/_types";

const SETTINGS_NAV_ITEM: NavItemDef = {
  href: "/settings",
  label: "Configuración",
  icon: "settings",
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
  const navItems: ReadonlyArray<NavItemDef> =
    sessionRole?.role === "admin" ? [...vertical.nav, SETTINGS_NAV_ITEM] : vertical.nav;

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header userEmail={session?.user?.email} navItems={navItems} />
      <div className="flex-1 flex min-h-0">
        <Sidebar items={navItems} />
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

import { auth } from "@/lib/auth";
import { verticalConfig } from "@/config/verticals";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // The /proxy.ts guard already redirects unauthenticated requests, so this
  // session() call is a safe source of truth for user-facing chrome.
  const session = await auth();
  const vertical = verticalConfig();
  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header userEmail={session?.user?.email} navItems={vertical.nav} />
      <div className="flex-1 flex min-h-0">
        <Sidebar items={vertical.nav} />
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

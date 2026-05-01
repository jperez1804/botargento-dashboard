import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { TenantBadge } from "./TenantBadge";
import { RefreshButton } from "./RefreshButton";
import { MobileNav } from "./MobileNav";
import type { NavItemDef } from "@/config/verticals/_types";

type HeaderProps = {
  userEmail: string | null | undefined;
  navItems: ReadonlyArray<NavItemDef>;
};

async function handleSignOut() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export function Header({ userEmail, navItems }: HeaderProps) {
  return (
    <header className="h-14 shrink-0 border-b border-[var(--rule)] bg-[var(--surface)] flex items-center justify-between gap-4 px-4">
      <div className="flex items-center gap-2 min-w-0">
        <MobileNav items={navItems} />
        <TenantBadge />
      </div>
      <div className="flex items-center gap-2">
        <RefreshButton />
        {userEmail && (
          <span className="hidden sm:inline text-xs text-[var(--muted-ink)] max-w-[200px] truncate">
            {userEmail}
          </span>
        )}
        <form action={handleSignOut}>
          <Button type="submit" variant="ghost" size="sm" aria-label="Cerrar sesión">
            <LogOut className="size-4" />
            <span className="sr-only sm:not-sr-only sm:ml-2">Salir</span>
          </Button>
        </form>
      </div>
    </header>
  );
}

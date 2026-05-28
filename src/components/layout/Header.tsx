import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { TenantBadge } from "./TenantBadge";
import { RefreshButton } from "./RefreshButton";
import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
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
    <header className="h-13 shrink-0 border-b border-[var(--rule)] bg-[var(--surface)] flex items-center justify-between gap-4 px-4">
      <div className="flex items-center gap-2.5 min-w-0">
        <MobileNav items={navItems} />
        <TenantBadge />
      </div>
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <RefreshButton />
        {userEmail && (
          <span className="hidden sm:inline text-[12.5px] text-[var(--muted-ink)] max-w-[200px] truncate px-1">
            {userEmail}
          </span>
        )}
        <form action={handleSignOut}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            aria-label="Cerrar sesión"
            className="text-[var(--muted-ink)] hover:text-[var(--ink)]"
          >
            <LogOut className="size-4" />
            <span className="sr-only sm:not-sr-only sm:ml-2">Salir</span>
          </Button>
        </form>
      </div>
    </header>
  );
}

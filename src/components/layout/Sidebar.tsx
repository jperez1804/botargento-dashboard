"use client";

import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavIconKey, NavItemDef } from "@/config/verticals/_types";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const ICON_MAP: Record<NavIconKey, IconComponent> = {
  dashboard: LayoutDashboard,
  conversations: MessageSquare,
  handoffs: ArrowLeftRight,
  "follow-up": ListTodo,
  settings: Settings,
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

type SidebarProps = {
  items: ReadonlyArray<NavItemDef>;
};

export function Sidebar({ items }: SidebarProps) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegación principal"
      className="hidden md:flex w-[240px] shrink-0 flex-col gap-1 border-r border-[var(--rule)] bg-[var(--surface)] px-3 py-4"
    >
      {items.map(({ href, label, icon }) => {
        const Icon = ICON_MAP[icon];
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "group/nav relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-[var(--client-primary)]/10 text-[var(--client-primary)] font-medium before:content-[''] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-[var(--client-primary)] before:rounded-full"
                : "text-[var(--ink)] hover:bg-[var(--canvas)]",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

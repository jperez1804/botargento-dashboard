"use client";

import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  HardHat,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Settings,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavIconKey, NavItemDef } from "@/config/verticals/_types";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const ICON_MAP: Record<NavIconKey, IconComponent> = {
  dashboard: LayoutDashboard,
  conversations: MessageSquare,
  handoffs: ArrowLeftRight,
  "follow-up": ListTodo,
  providers: Truck,
  "labor-pool": HardHat,
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
      className="hidden md:flex w-[232px] shrink-0 flex-col gap-px border-r border-[var(--rule)] bg-[var(--surface)] px-3 py-4"
    >
      {items.map(({ href, label, icon }) => {
        const Icon = ICON_MAP[icon];
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              // Operator-console nav item. Active state: brand-color 2px
              // rail flush with the sidebar's outer left edge + bold ink
              // text + raised canvas-2 fill. NO brand-tinted text — the
              // rail is the single signal that this section is current.
              "group/nav relative flex items-center gap-2.5 rounded-md px-2.5 h-8 text-[13.5px] transition-colors",
              "focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-2",
              active
                ? "bg-[var(--canvas-2)] text-[var(--ink)] font-semibold before:content-[''] before:absolute before:left-[-12px] before:top-1.5 before:bottom-1.5 before:w-[2px] before:rounded-r-sm before:bg-[var(--client-primary)]"
                : "text-[var(--muted-ink)] font-medium hover:bg-[var(--canvas-2)] hover:text-[var(--ink)]",
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0",
                active ? "text-[var(--ink)]" : "text-[var(--soft-ink)] group-hover/nav:text-[var(--ink)]",
              )}
              aria-hidden="true"
            />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

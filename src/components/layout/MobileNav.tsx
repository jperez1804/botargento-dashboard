"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import {
  ArrowLeftRight,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NavIconKey, NavItemDef } from "@/config/verticals/_types";

const ICON_MAP: Record<NavIconKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  dashboard: LayoutDashboard,
  conversations: MessageSquare,
  handoffs: ArrowLeftRight,
  "follow-up": ListTodo,
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

type Props = { items: ReadonlyArray<NavItemDef> };

export function MobileNav({ items }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the sheet when the route changes
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu className="size-4" />
      </Button>

      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <nav
            aria-label="Navegación móvil"
            className="absolute left-0 top-0 bottom-0 w-[260px] bg-white border-r border-[#e5e7eb] p-3 flex flex-col gap-1"
          >
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
              >
                <X className="size-4" />
              </Button>
            </div>
            {items.map(({ href, label, icon }) => {
              const Icon = ICON_MAP[icon];
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-[var(--client-primary)]/10 text-[var(--client-primary)] font-medium"
                      : "text-[#374151] hover:bg-[#f3f4f6]",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}

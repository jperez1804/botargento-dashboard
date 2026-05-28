"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

// Theme toggle. The initial theme is set by an inline script in
// src/app/layout.tsx so the .dark class is present BEFORE first paint,
// avoiding a flash of unstyled light content on subsequent loads. This
// component reads + flips the class on click and persists the choice in
// localStorage.
//
// Uses useSyncExternalStore (rather than useEffect + useState) so the
// hydration boundary is handled by React: the server renders with the
// neutral "light" snapshot and the client immediately reads the actual
// classList value once mounted — no cascading setState, no FOUC, no
// lint complaints.

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

// Subscriber list so toggle() can tell every mounted ThemeToggle to
// re-read its snapshot. We only mutate classList from one place
// (toggle), so we control when to notify.
const listeners = new Set<() => void>();
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function notify(): void {
  for (const cb of listeners) cb();
}

function getClientSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
function getServerSnapshot(): Theme {
  return "light";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  function toggle(): void {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    if (next === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private-mode / Storage-disabled — toggle still works for the
      // current session, just doesn't persist.
    }
    notify();
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted-ink)] hover:bg-[var(--canvas-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-2 transition-colors",
      )}
    >
      {isDark ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Moon className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}

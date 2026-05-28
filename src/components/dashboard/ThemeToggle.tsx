"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

// Theme toggle. The initial theme is set by an inline script in
// src/app/layout.tsx so the .dark class is present BEFORE first paint,
// avoiding a flash of unstyled light content on subsequent loads. This
// component reads + flips the class on click and persists the choice in
// localStorage.

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  // Tracks whether we've hydrated. Until then we render the toggle in a
  // neutral state to avoid a button-flip on first paint when the inline
  // script has set .dark but React initially renders without it.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setTheme(readTheme());
    setHydrated(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    const root = document.documentElement;
    if (next === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private-mode / Storage-disabled — toggle still works for the
      // current session, just doesn't persist.
    }
  }

  const isDark = hydrated && theme === "dark";
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

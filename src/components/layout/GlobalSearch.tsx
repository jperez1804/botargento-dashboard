"use client";

// Header search: finds a lead or conversation by name or phone from any page.
// Submitting goes to /buscar?q=…; "/" focuses the field (unless the user is
// already typing somewhere), like most operator consoles.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { SEARCH_LABELS as L } from "@/config/search-labels";

export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      className="relative hidden w-full max-w-[320px] md:block"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (q) router.push(`/buscar?q=${encodeURIComponent(q)}`);
      }}
    >
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--soft-ink)]"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        data-testid="global-search"
        aria-label={L.placeholder}
        placeholder={L.placeholder}
        title={L.shortcutHint}
        value={value}
        maxLength={80}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-full rounded-md border border-[var(--rule)] bg-[var(--canvas)] pl-8 pr-8 text-[13px] text-[var(--ink)] placeholder:text-[var(--soft-ink)] focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)]"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[var(--rule)] px-1 font-[var(--font-geist-mono)] text-[10.5px] text-[var(--soft-ink)]">
        /
      </kbd>
    </form>
  );
}

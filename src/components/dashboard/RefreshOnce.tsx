"use client";

// Refetches the server tree once, after the navigation that mounted it has
// landed. Used by the lead modal when it opens right after "Nuevo lead": the
// board underneath was rendered before the lead existed and would otherwise
// stay stale until the next navigation. router.refresh() keeps client state,
// so this component is not remounted by its own refresh.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RefreshOnce() {
  const router = useRouter();
  useEffect(() => {
    router.refresh();
  }, [router]);
  return null;
}

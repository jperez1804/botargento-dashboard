"use client";

// The lead's full card as a modal over the board (Jira issue view). Rendered
// by the intercepted route @modal/(.)leads/[waId]; the server pages pass the
// content as children. Closing = router.back(), which returns to the exact
// board URL (filters included) and restores its cache. Guarded so Esc plus a
// backdrop click before the navigation lands only fire back() once. `open`
// follows the URL: after back() the slot can stay mounted with the old page,
// so the dialog must close itself the moment the pathname is no longer the
// lead's.

import { useEffect, useRef } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type Props = { ariaLabel: string; children: React.ReactNode };

export function LeadDetailModal({ ariaLabel, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const closing = useRef(false);
  const open = pathname === `/leads/${params.id}`;
  // The slot instance can be reused for the next open of the same lead.
  useEffect(() => {
    if (open) closing.current = false;
  }, [open]);
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (open || closing.current) return;
        closing.current = true;
        router.back();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-label={ariaLabel}
        data-testid="lead-detail-modal"
        className="w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[1100px]"
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

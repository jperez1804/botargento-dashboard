"use client";

// Turns a conversation into an opportunity, for the two places where a person
// decides what the bot would not: somebody who wrote and never got handed off,
// and somebody asking about a rubro nobody is working. One click, with the
// rubro already detected.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorText, postLead } from "@/lib/crm/api-client";
import type { CrmLabels } from "@/config/verticals/_types";

type Props = {
  contactWaId: string;
  // Vertical intent key; '' opens it without a rubro.
  kind: string;
  labels: CrmLabels;
  size?: "xs" | "sm";
  // Where to go once it exists: the person's page on that opportunity.
  followTo?: "opportunity" | "refresh";
};

export function OpenOpportunityButton({
  contactWaId,
  kind,
  labels,
  size = "sm",
  followTo = "opportunity",
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    const res = await postLead("open", { contactWaId, kind });
    setBusy(false);
    if (!res.ok) {
      toast.error(errorText(labels.errors, res.error));
      return;
    }
    toast.success(labels.opportunity.createdToast);
    if (followTo === "opportunity" && res.opportunityId) {
      router.push(`/conversations/${encodeURIComponent(contactWaId)}?op=${res.opportunityId}`);
    }
    router.refresh();
  }

  return (
    <Button
      type="button"
      size={size}
      variant="outline"
      data-testid="open-opportunity"
      disabled={busy}
      onClick={() => void open()}
      className="shrink-0"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
      {labels.opportunity.openFromIntent}
    </Button>
  );
}

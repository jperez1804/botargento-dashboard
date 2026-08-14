// Two-way inbox — conversation detail: timeline + Tomar/Devolver toggle +
// reply composer. Reads are views/lead_log; every write goes through
// /api/inbox/* → the n8n inbox webhook.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/role-guard";
import { inboxEnabled } from "@/lib/inbox";
import { getContact, getConversation } from "@/lib/queries/contacts";
import { getConversationControl, getWindowState } from "@/lib/queries/inbox";
import { tenantConfig } from "@/config/tenant";
import { verticalConfig } from "@/config/verticals";
import { ConversationTimeline } from "@/components/dashboard/ConversationTimeline";
import {
  InboxControlBar,
  InboxComposer,
  InboxThread,
} from "@/components/dashboard/InboxControls";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ waId: string }>;
};

export default async function InboxConversationPage({ params }: Props) {
  if (!inboxEnabled()) notFound();
  await requireRole("admin");

  const { waId } = await params;
  const [contact, entries, control, windowState] = await Promise.all([
    getContact(waId),
    getConversation(waId),
    getConversationControl(waId),
    getWindowState(waId),
  ]);
  if (!contact) notFound();

  const tenant = tenantConfig();
  const vertical = verticalConfig();
  const contactName = contact.displayName ?? contact.contactWaId;

  return (
    /* Real chat layout: the page itself never scrolls — the column is bound
     * to the viewport, only the THREAD scrolls inside its own container, and
     * the control bar + composer stay visible no matter what. This is what
     * keeps the composer on screen across send/poll refreshes. */
    <div className="flex flex-col gap-3 h-[calc(100dvh-150px)] min-h-[420px]">
      <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-3 text-[13px] shrink-0">
        <Link
          href="/inbox"
          className="inline-flex items-center gap-1.5 text-[var(--muted-ink)] hover:text-[var(--ink)] hover:underline underline-offset-[3px] rounded focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-2"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          Inbox
        </Link>
        <span aria-hidden="true" className="text-[var(--rule-strong)]">
          /
        </span>
        <span className="text-[var(--ink)] font-semibold truncate min-w-0">{contactName}</span>
        {contact.displayName ? (
          <span className="text-[12px] text-[var(--soft-ink)] font-[var(--font-geist-mono)] tabular-nums">
            {contact.contactWaId}
          </span>
        ) : null}
      </nav>

      <div className="shrink-0">
        <InboxControlBar
          waId={contact.contactWaId}
          mode={control.mode}
          takenBy={control.takenBy}
        />
      </div>

      {/* The only scrollable region — WhatsApp scroll semantics (follow when
       * at the bottom, unread pill when reading history) live in InboxThread. */}
      <InboxThread entriesCount={entries.length}>
        <ConversationTimeline
          entries={entries}
          intents={vertical.intents}
          locale={tenant.locale}
          timezone={tenant.timezone}
        />
      </InboxThread>

      <div className="shrink-0">
        <InboxComposer
          waId={contact.contactWaId}
          mode={control.mode}
          inWindow={windowState.inWindow}
        />
      </div>
    </div>
  );
}

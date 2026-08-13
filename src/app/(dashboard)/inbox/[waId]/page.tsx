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
  ScrollToLatest,
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
    <div className="space-y-6">
      <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-3 text-[13px]">
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
        <span className="text-[var(--ink)] font-medium truncate min-w-0">{contactName}</span>
      </nav>

      <header className="space-y-1.5">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] leading-[1.15] text-[var(--ink)]">
          {contactName}
        </h1>
        {contact.displayName ? (
          <div className="text-[12.5px] text-[var(--soft-ink)] font-[var(--font-geist-mono)] tabular-nums">
            {contact.contactWaId}
          </div>
        ) : null}
      </header>

      {/* WhatsApp-style layout: control bar as chat header, thread in the
       * middle, composer sticky at the bottom next to the newest messages,
       * with the view pinned to the latest entry. */}
      <InboxControlBar
        waId={contact.contactWaId}
        mode={control.mode}
        takenBy={control.takenBy}
      />

      <ConversationTimeline
        entries={entries}
        intents={vertical.intents}
        locale={tenant.locale}
        timezone={tenant.timezone}
      />

      <ScrollToLatest entriesCount={entries.length} />

      <InboxComposer
        waId={contact.contactWaId}
        mode={control.mode}
        inWindow={windowState.inWindow}
      />
    </div>
  );
}

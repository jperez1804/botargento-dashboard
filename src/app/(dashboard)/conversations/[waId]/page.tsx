import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getContact, getConversation } from "@/lib/queries/contacts";
import { tenantConfig } from "@/config/tenant";
import { verticalConfig } from "@/config/verticals";
import { ConversationTimeline } from "@/components/dashboard/ConversationTimeline";
import { ContactSidebar } from "@/components/dashboard/ContactSidebar";
import { formatAutomationLabel } from "@/lib/automation-labels";
import type { IntentDef } from "@/config/verticals/_types";

type Props = {
  params: Promise<{ waId: string }>;
};

function resolveLastIntent(
  raw: string | null | undefined,
  intents: ReadonlyArray<IntentDef>,
): string | null {
  if (!raw) return null;
  const hit = intents.find((i) => i.key.toLowerCase() === raw.toLowerCase());
  return hit?.label ?? formatAutomationLabel(raw) ?? raw;
}

export default async function ConversationDetailPage({ params }: Props) {
  const { waId } = await params;
  const [contact, entries] = await Promise.all([getContact(waId), getConversation(waId)]);
  if (!contact) notFound();

  const tenant = tenantConfig();
  const vertical = verticalConfig();
  const lastIntentLabel = resolveLastIntent(contact.lastIntent, vertical.intents);
  const contactName = contact.displayName ?? contact.contactWaId;

  return (
    <div className="space-y-6">
      <nav
        aria-label="Migas de pan"
        className="flex flex-wrap items-center gap-3 text-[13px]"
      >
        <Link
          href="/conversations"
          className="inline-flex items-center gap-1.5 text-[var(--muted-ink)] hover:text-[var(--ink)] hover:underline underline-offset-[3px] rounded focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-2"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          Conversaciones
        </Link>
        <span aria-hidden="true" className="text-[var(--rule-strong)]">
          /
        </span>
        <span className="text-[var(--ink)] font-medium truncate min-w-0">
          {contactName}
        </span>
      </nav>

      {/* Two-column layout — thread on the LEFT (wide), contact rail on the
       * RIGHT (narrow). On mobile (single column) the rail stacks ABOVE the
       * thread so operators see the contact context first.
       *
       * Bug history: previous version set `order-2 lg:order-1` on the
       * <section> but no order on <ContactSidebar>, leaving it at the
       * default order-0. On desktop that placed the sidebar in column 1
       * (1fr, wide) and the thread in column 2 (300px, narrow) — exactly
       * inverted from the mock. Both children now declare explicit orders
       * for both breakpoints to make the grid placement unambiguous. */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1fr_300px]">
        <section className="min-w-0 space-y-4 order-2 lg:order-1">
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

          <ConversationTimeline
            entries={entries}
            intents={vertical.intents}
            locale={tenant.locale}
            timezone={tenant.timezone}
          />
        </section>

        <div className="order-1 lg:order-2">
          <ContactSidebar
            contact={contact}
            locale={tenant.locale}
            timezone={tenant.timezone}
            lastIntentLabel={lastIntentLabel}
          />
        </div>
      </div>
    </div>
  );
}

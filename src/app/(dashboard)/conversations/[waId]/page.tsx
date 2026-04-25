import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getContact, getConversation } from "@/lib/queries/contacts";
import { tenantConfig } from "@/config/tenant";
import { verticalConfig } from "@/config/verticals";
import { ConversationTimeline } from "@/components/dashboard/ConversationTimeline";
import { formatDateTime } from "@/lib/date";
import { formatNumber } from "@/lib/format";

type Props = {
  params: Promise<{ waId: string }>;
};

export default async function ConversationDetailPage({ params }: Props) {
  const { waId } = await params;
  const [contact, entries] = await Promise.all([getContact(waId), getConversation(waId)]);
  if (!contact) notFound();

  const tenant = tenantConfig();
  const vertical = verticalConfig();

  return (
    <div className="space-y-6">
      <Link
        href="/conversations"
        className="inline-flex items-center gap-1 text-xs text-[#374151] hover:text-[#111827]"
      >
        <ArrowLeft className="size-3" /> Volver a conversaciones
      </Link>

      <header className="rounded-md border border-[#e5e7eb] bg-white p-5 space-y-2">
        <h1 className="text-[20px] font-semibold leading-tight">
          {contact.displayName ?? contact.contactWaId}
        </h1>
        {contact.displayName && (
          <div className="text-xs text-[#9ca3af] tabular-nums">{contact.contactWaId}</div>
        )}
        <dl className="grid gap-3 grid-cols-2 sm:grid-cols-4 pt-2 text-xs">
          <div>
            <dt className="text-[#6b7280] uppercase tracking-wide">Mensajes</dt>
            <dd className="text-[#111827] font-medium tabular-nums">
              {formatNumber(contact.messageCount, tenant.locale)}
            </dd>
          </div>
          <div>
            <dt className="text-[#6b7280] uppercase tracking-wide">Derivaciones</dt>
            <dd className="text-[#111827] font-medium tabular-nums">
              {formatNumber(contact.handoffCount, tenant.locale)}
            </dd>
          </div>
          <div>
            <dt className="text-[#6b7280] uppercase tracking-wide">Primer contacto</dt>
            <dd className="text-[#111827] font-medium tabular-nums">
              {formatDateTime(contact.firstSeen, tenant.locale, tenant.timezone)}
            </dd>
          </div>
          <div>
            <dt className="text-[#6b7280] uppercase tracking-wide">Último contacto</dt>
            <dd className="text-[#111827] font-medium tabular-nums">
              {formatDateTime(contact.lastSeen, tenant.locale, tenant.timezone)}
            </dd>
          </div>
        </dl>
      </header>

      <ConversationTimeline
        entries={entries}
        intents={vertical.intents}
        locale={tenant.locale}
        timezone={tenant.timezone}
      />
    </div>
  );
}

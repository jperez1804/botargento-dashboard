// Two-way inbox — conversation list. Feature-gated per tenant: the vertical
// must declare inboxTab AND the tenant env must carry the n8n webhook pair
// (inboxEnabled()); everyone else 404s. Admin-only, same as the API routes.

import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot, Hand } from "lucide-react";
import { requireRole } from "@/lib/role-guard";
import { inboxEnabled } from "@/lib/inbox";
import { listContacts } from "@/lib/queries/contacts";
import { listHumanControlled } from "@/lib/queries/inbox";
import { tenantConfig } from "@/config/tenant";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  if (!inboxEnabled()) notFound();
  await requireRole("admin");

  const tenant = tenantConfig();
  const [contacts, humanControlled] = await Promise.all([
    listContacts({ limit: 50 }),
    listHumanControlled(),
  ]);
  const takenBy = new Map(humanControlled.map((h) => [h.contactWaId, h.takenBy]));

  const dateFmt = new Intl.DateTimeFormat(tenant.locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tenant.timezone,
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] leading-[1.15] text-[var(--ink)]">
          Inbox
        </h1>
        <p className="text-[13px] text-[var(--muted-ink)] max-w-[560px]">
          Respondé a mano y pausá el bot por conversación. Elegí un contacto para
          abrir el hilo.
        </p>
      </header>

      {contacts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--rule-strong)] bg-[var(--surface)] py-10 px-6 text-center text-[13px] text-[var(--soft-ink)]">
          Todavía no hay conversaciones.
        </div>
      ) : (
        <ul className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] divide-y divide-[var(--rule)]">
          {contacts.map((c) => (
            <li key={c.contactWaId}>
              <Link
                href={`/inbox/${c.contactWaId}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--canvas-2)] focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:-outline-offset-2"
              >
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium text-[var(--ink)] truncate">
                    {c.displayName ?? c.contactWaId}
                  </div>
                  <div className="text-[12px] text-[var(--soft-ink)] font-[var(--font-geist-mono)] tabular-nums">
                    {c.contactWaId} · {c.messageCount} mensajes
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  {takenBy.has(c.contactWaId) ? (
                    <span
                      title={`A cargo de ${takenBy.get(c.contactWaId) || "un agente"}`}
                      className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklch,var(--client-primary)_55%,var(--rule))] bg-[color-mix(in_oklch,var(--client-primary)_10%,var(--surface))] px-2 py-0.5 text-[11px] font-medium text-[color-mix(in_oklch,var(--client-primary)_80%,var(--ink))]"
                    >
                      <Hand className="size-3" aria-hidden="true" />
                      Tomada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--rule)] bg-[var(--canvas-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--soft-ink)]">
                      <Bot className="size-3" aria-hidden="true" />
                      Bot
                    </span>
                  )}
                  <span className="text-[12px] text-[var(--soft-ink)] tabular-nums">
                    {dateFmt.format(new Date(c.lastSeen))}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

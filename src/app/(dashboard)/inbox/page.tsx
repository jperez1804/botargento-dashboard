// Two-way inbox — conversation list with quick filters. Feature-gated per
// tenant (inboxEnabled: vertical capability + webhook env pair); admin-only.
// Filter/search state lives in the URL (?filter=…&q=…) — InboxFilters writes
// it, this server component reads it, and the 30s poller preserves it.

import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot, Hand } from "lucide-react";
import { requireRole } from "@/lib/role-guard";
import { inboxEnabled } from "@/lib/inbox";
import {
  countUnreadConversations,
  listInboxConversations,
  INBOX_FILTERS,
  type InboxFilter,
} from "@/lib/queries/inbox";
import { tenantConfig } from "@/config/tenant";
import { InboxListPoller } from "@/components/dashboard/InboxControls";
import { InboxFilters } from "@/components/dashboard/InboxFilters";

export const dynamic = "force-dynamic";

const EMPTY_COPY: Record<InboxFilter, string> = {
  all: "Todavía no hay conversaciones.",
  unread: "No hay conversaciones sin leer 🎉",
  taken: "No tenés conversaciones tomadas — el bot está atendiendo todo.",
  handoff: "Todavía no hay conversaciones con derivación.",
  window: "Ninguna conversación tiene la ventana de 24h abierta.",
};

type Props = {
  searchParams: Promise<{ filter?: string; q?: string }>;
};

export default async function InboxPage({ searchParams }: Props) {
  if (!inboxEnabled()) notFound();
  await requireRole("admin");

  const sp = await searchParams;
  const filter: InboxFilter = (INBOX_FILTERS as readonly string[]).includes(sp.filter ?? "")
    ? (sp.filter as InboxFilter)
    : "all";
  const q = (sp.q ?? "").trim().slice(0, 80);

  const tenant = tenantConfig();
  const [conversations, unreadTotal] = await Promise.all([
    listInboxConversations({ filter, q }),
    countUnreadConversations(),
  ]);

  const dateFmt = new Intl.DateTimeFormat(tenant.locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tenant.timezone,
  });

  return (
    <div className="space-y-5">
      <InboxListPoller />
      <header className="space-y-1.5">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] leading-[1.15] text-[var(--ink)]">
          Inbox
        </h1>
        <p className="text-[13px] text-[var(--muted-ink)] max-w-[560px]">
          Respondé a mano y pausá el bot por conversación. Elegí un contacto para
          abrir el hilo.
        </p>
      </header>

      <InboxFilters activeFilter={filter} q={q} unreadTotal={unreadTotal} />

      {conversations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--rule-strong)] bg-[var(--surface)] py-10 px-6 text-center text-[13px] text-[var(--soft-ink)]">
          {q ? <>Sin resultados para «{q}».</> : EMPTY_COPY[filter]}
        </div>
      ) : (
        <ul className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] divide-y divide-[var(--rule)]">
          {conversations.map((c) => (
            <li key={c.contactWaId}>
              <Link
                href={`/inbox/${c.contactWaId}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--canvas-2)] focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:-outline-offset-2"
              >
                <div className="min-w-0">
                  <div
                    className={
                      c.unread > 0
                        ? "text-[13.5px] font-bold text-[var(--ink)] truncate"
                        : "text-[13.5px] font-medium text-[var(--ink)] truncate"
                    }
                  >
                    {c.displayName ?? c.contactWaId}
                  </div>
                  <div className="text-[12px] text-[var(--soft-ink)] font-[var(--font-geist-mono)] tabular-nums">
                    {c.contactWaId} · {c.messageCount} mensajes
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  {c.unread > 0 ? (
                    <span
                      aria-label={`${c.unread} mensajes sin leer`}
                      className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-[var(--client-primary)] text-[color-mix(in_oklch,var(--client-primary)_18%,black)] text-[11.5px] font-bold tabular-nums"
                    >
                      {c.unread}
                    </span>
                  ) : null}
                  {c.mode === "human" ? (
                    <span
                      title={`A cargo de ${c.takenBy || "un agente"}`}
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

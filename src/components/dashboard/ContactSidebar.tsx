"use client";

import { MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/date";
import { formatNumber } from "@/lib/format";
import type { ContactRecord } from "@/lib/queries/contacts";

type Props = {
  contact: ContactRecord;
  locale: string;
  timezone: string;
  lastIntentLabel: string | null;
};

// Right-rail sidebar for the conversation thread. Three stacked cards:
// Contact (definition list), Métricas (2-up KPI tiles), Acciones (only
// the WhatsApp deep-link in v1 — transcript export lands in a follow-up).
//
// Each card uses the same Caption pattern as the rest of the dashboard:
// 11 px / 500 / uppercase / 0.08em / soft-ink, sitting 10-12 px above the
// content.
export function ContactSidebar({ contact, locale, timezone, lastIntentLabel }: Props) {
  const waLink = `https://wa.me/${encodeURIComponent(contact.contactWaId)}`;
  return (
    <aside className="space-y-3">
      {/* Contact card */}
      <Card>
        <CardContent className="px-5 py-4 space-y-3">
          <Caption>Contacto</Caption>
          <dl className="space-y-2">
            <Row term="WaID">
              <span className="font-[var(--font-geist-mono)]">{contact.contactWaId}</span>
            </Row>
            <Row term="Primer contacto">
              <span className="tabular-nums">
                {formatDateTime(contact.firstSeen, locale, timezone)}
              </span>
            </Row>
            <Row term="Último contacto">
              <span className="tabular-nums">
                {formatDateTime(contact.lastSeen, locale, timezone)}
              </span>
            </Row>
            <Row term="Última intención">
              {lastIntentLabel ? (
                <span className="inline-flex items-center gap-1.5 h-[20px] px-2 rounded-full bg-[var(--info-soft)] text-[var(--info)] text-[11.5px] font-medium">
                  <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                  {lastIntentLabel}
                </span>
              ) : (
                <span className="text-[var(--soft-ink)] italic">sin registrar</span>
              )}
            </Row>
          </dl>
        </CardContent>
      </Card>

      {/* Metrics card */}
      <Card>
        <CardContent className="px-5 py-4 space-y-3">
          <Caption>Métricas (contacto)</Caption>
          <div className="grid grid-cols-2 gap-3">
            <Tile label="Mensajes" value={formatNumber(contact.messageCount, locale)} />
            <Tile
              label="Derivaciones"
              value={formatNumber(contact.handoffCount, locale)}
              dim={contact.handoffCount === 0}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions card */}
      <Card>
        <CardContent className="px-5 py-4 space-y-3">
          <Caption>Acciones</Caption>
          <div className="flex flex-col gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" aria-hidden="true" />
                Abrir en WhatsApp
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)]">
      {children}
    </p>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-[13px]">
      <dt className="text-[var(--soft-ink)] shrink-0">{term}</dt>
      <dd className="text-[var(--ink)] text-right min-w-0 truncate">{children}</dd>
    </div>
  );
}

function Tile({
  label,
  value,
  dim,
}: {
  label: string;
  value: string;
  dim?: boolean;
}) {
  return (
    <div className="space-y-0.5 min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-[0.04em] text-[var(--soft-ink)]">
        {label}
      </p>
      <p
        className={
          dim
            ? "text-[22px] font-semibold tracking-[-0.02em] tabular-nums text-[var(--faint-ink)]"
            : "text-[22px] font-semibold tracking-[-0.02em] tabular-nums text-[var(--ink)]"
        }
      >
        {value}
      </p>
    </div>
  );
}

// Two-way inbox gating + the server-side bridge to the tenant's n8n inbox
// webhook. The dashboard NEVER writes to automation.* — every write action
// (send / takeover / release) is delegated to n8n, the only party with write
// access, via this authenticated webhook. See the plan in the sales workspace:
// docs/ventas/two-way-inbox-plan.md.

import { env } from "@/lib/env";
import { verticalConfig } from "@/config/verticals";

export type InboxAction = "send" | "takeover" | "release";

export type InboxWebhookResult = {
  status: number;
  ok: boolean;
  error?: string;
  outboundMessageId?: string;
};

/**
 * The tab is active only when BOTH hold:
 *  - the vertical declares the capability (features.inboxTab), and
 *  - the tenant env carries the webhook URL + token (only tenants whose n8n
 *    actually has the inbox webhook deployed set these).
 * This is what keeps the shared image from surfacing the inbox on tenants
 * that didn't opt in.
 */
export function inboxEnabled(): boolean {
  const e = env();
  return Boolean(
    verticalConfig().features?.inboxTab &&
      e.N8N_INBOX_WEBHOOK_URL &&
      e.N8N_INBOX_WEBHOOK_TOKEN,
  );
}

export async function callInboxWebhook(
  action: InboxAction,
  payload: { contactWaId: string; text?: string; agentEmail: string },
): Promise<InboxWebhookResult> {
  const e = env();
  if (!e.N8N_INBOX_WEBHOOK_URL || !e.N8N_INBOX_WEBHOOK_TOKEN) {
    return { status: 503, ok: false, error: "inbox_not_configured" };
  }

  const res = await fetch(e.N8N_INBOX_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Inbox-Token": e.N8N_INBOX_WEBHOOK_TOKEN,
    },
    body: JSON.stringify({
      action,
      contact_wa_id: payload.contactWaId,
      text: payload.text ?? "",
      agent_email: payload.agentEmail,
    }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });

  // The webhook responds JSON both on success and on typed errors (401/400/
  // 409/502) — parse defensively so an n8n outage doesn't throw opaquely.
  let body: { ok?: boolean; error?: string; outbound_message_id?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { status: res.status, ok: false, error: `bad_webhook_response_${res.status}` };
  }

  return {
    status: res.status,
    ok: res.ok && body.ok === true,
    error: body.error,
    outboundMessageId: body.outbound_message_id || undefined,
  };
}

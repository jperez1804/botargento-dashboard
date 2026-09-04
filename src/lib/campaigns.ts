// Campaign-actions gating + the server-side bridge to the tenant's n8n
// campaign-actions webhook. Mirrors src/lib/inbox.ts: the dashboard NEVER
// writes outreach.* (dashboard_app is SELECT-only there) — pausing/resuming a
// campaign or editing its cap is delegated to n8n via this authenticated
// webhook. Plan: Sales Automation docs/ventas (campañas v2).

import { env } from "@/lib/env";
import { verticalConfig } from "@/config/verticals";

export type CampaignAction = "set_status" | "set_cap";

export type CampaignWebhookResult = {
  status: number;
  ok: boolean;
  error?: string;
  campaign?: { id: number; name: string; status: string; daily_cap: number };
};

/**
 * Actions render only when BOTH hold: the vertical declares the campaigns tab
 * AND the tenant env carries the webhook pair. Keeps the shared image
 * read-only on tenants that didn't opt in.
 */
export function campaignActionsEnabled(): boolean {
  const e = env();
  return Boolean(
    verticalConfig().features?.campaignsTab &&
      e.N8N_CAMPAIGN_WEBHOOK_URL &&
      e.N8N_CAMPAIGN_WEBHOOK_TOKEN,
  );
}

export async function callCampaignWebhook(
  action: CampaignAction,
  payload: { campaignId: number; status?: string; dailyCap?: number; agentEmail: string },
): Promise<CampaignWebhookResult> {
  const e = env();
  if (!e.N8N_CAMPAIGN_WEBHOOK_URL || !e.N8N_CAMPAIGN_WEBHOOK_TOKEN) {
    return { status: 503, ok: false, error: "campaigns_not_configured" };
  }

  const res = await fetch(e.N8N_CAMPAIGN_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Campaign-Token": e.N8N_CAMPAIGN_WEBHOOK_TOKEN,
    },
    body: JSON.stringify({
      action,
      campaign_id: payload.campaignId,
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.dailyCap !== undefined ? { daily_cap: payload.dailyCap } : {}),
      agent_email: payload.agentEmail,
    }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });

  let body: {
    ok?: boolean;
    error?: string;
    campaign?: { id: number; name: string; status: string; daily_cap: number };
  } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { status: res.status, ok: false, error: `bad_webhook_response_${res.status}` };
  }

  return {
    status: res.status,
    ok: res.ok && body.ok === true,
    error: body.error,
    campaign: body.campaign,
  };
}

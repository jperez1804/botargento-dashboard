// Shared handler for /api/campaigns/*. Mirrors the inbox trio: admin-only →
// tenant gate (404 when campaign actions aren't configured) → Zod → delegate
// the write to the n8n campaign-actions webhook → audit row in
// dashboard.audit_log (the outreach.* SELECT-only invariant holds).

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/role-guard";
import {
  campaignActionsEnabled,
  callCampaignWebhook,
  type CampaignAction,
} from "@/lib/campaigns";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";
import { logger } from "@/lib/logger";

const SetStatusBody = z.object({
  campaignId: z.number().int().positive(),
  status: z.enum(["active", "paused", "done"]),
});

const SetCapBody = z.object({
  campaignId: z.number().int().positive(),
  dailyCap: z.number().int().min(1).max(100),
});

export function makeCampaignHandler(action: CampaignAction) {
  return async function POST(request: Request) {
    const session = await requireRole("admin");

    if (!campaignActionsEnabled()) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const parsed = (action === "set_status" ? SetStatusBody : SetCapBody).safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body = parsed.data as z.infer<typeof SetStatusBody> & z.infer<typeof SetCapBody>;

    try {
      const result = await callCampaignWebhook(action, {
        campaignId: body.campaignId,
        status: "status" in body ? body.status : undefined,
        dailyCap: "dailyCap" in body ? body.dailyCap : undefined,
        agentEmail: session.email,
      });

      // Audit regardless of outcome — a failed pause attempt is still an
      // operator action worth reconstructing.
      await db.insert(auditLog).values({
        email: session.email,
        action: `campaign_${action}`,
        metadata: {
          campaign_id: body.campaignId,
          ...("status" in body && body.status ? { status: body.status } : {}),
          ...("dailyCap" in body && body.dailyCap ? { daily_cap: body.dailyCap } : {}),
          ok: result.ok,
          ...(result.error ? { error: result.error } : {}),
        },
      });

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error ?? "webhook_failed" },
          { status: result.status >= 400 ? result.status : 502 },
        );
      }

      return NextResponse.json({ ok: true, campaign: result.campaign });
    } catch (err) {
      logger.error({ err, action, email: session.email }, "Campaign webhook call failed");
      return NextResponse.json({ error: "webhook_unreachable" }, { status: 502 });
    }
  };
}

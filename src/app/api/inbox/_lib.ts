// Shared handler for the /api/inbox/* route trio. Every action: admin-only →
// tenant gate (404 when the inbox isn't configured for this tenant) → Zod →
// delegate the write to the n8n inbox webhook → audit row in dashboard.audit_log
// (dashboard_app CAN write dashboard.* — the automation.* invariant holds).

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/role-guard";
import { inboxEnabled, callInboxWebhook, type InboxAction } from "@/lib/inbox";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";
import { logger } from "@/lib/logger";

const SendBody = z.object({
  contactWaId: z.string().regex(/^[0-9]{8,15}$/, "contactWaId must be 8-15 digits"),
  text: z.string().min(1).max(4000),
});

const ToggleBody = z.object({
  contactWaId: z.string().regex(/^[0-9]{8,15}$/, "contactWaId must be 8-15 digits"),
});

export function makeInboxHandler(action: InboxAction) {
  return async function POST(request: Request) {
    const session = await requireRole("admin");

    if (!inboxEnabled()) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const schema = action === "send" ? SendBody : ToggleBody;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body = parsed.data as z.infer<typeof SendBody>;

    try {
      const result = await callInboxWebhook(action, {
        contactWaId: body.contactWaId,
        text: "text" in body ? body.text : undefined,
        agentEmail: session.email,
      });

      // Audit regardless of outcome — a failed send attempt is still an
      // operator action worth reconstructing.
      await db.insert(auditLog).values({
        email: session.email,
        action: `inbox_${action}`,
        metadata: {
          contact_wa_id: body.contactWaId,
          ...(action === "send"
            ? { text: body.text, outbound_message_id: result.outboundMessageId ?? "" }
            : {}),
          ok: result.ok,
          ...(result.error ? { error: result.error } : {}),
        },
      });

      if (!result.ok) {
        // Surface the webhook's typed errors (409 fuera de ventana, 502 Meta
        // reject) with their original status so the composer can message them.
        return NextResponse.json(
          { error: result.error ?? "webhook_failed" },
          { status: result.status >= 400 ? result.status : 502 },
        );
      }

      return NextResponse.json({
        ok: true,
        ...(result.outboundMessageId ? { outboundMessageId: result.outboundMessageId } : {}),
      });
    } catch (err) {
      logger.error({ err, action, email: session.email }, "Inbox webhook call failed");
      return NextResponse.json({ error: "webhook_unreachable" }, { status: 502 });
    }
  };
}

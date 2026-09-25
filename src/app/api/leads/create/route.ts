// Register a lead that did not come through WhatsApp (phone call, walk-in,
// listing portal, referral). Asesor or admin → CRM gate → Zod → phone
// normalized to the WhatsApp id → effect in dashboard.* → audit row
// (lead_create) written even when the effect fails.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/role-guard";
import { crmConfig } from "@/lib/crm/enabled";
import { normalizeLeadPhone } from "@/lib/crm/phone";
import { createManualLead } from "@/lib/queries/lead-writes";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";
import { logger } from "@/lib/logger";
import { crmKinds } from "@/lib/crm/intent";

const Body = z.object({
  phone: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  source: z.string().trim().min(1).max(40),
  // A key from the vertical's intents: the rubro of the first opportunity.
  intent: z.string().trim().max(60),
  note: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireRoleApi("asesor");
  if (auth.response) return auth.response;
  const { session } = auth;

  const config = crmConfig();
  if (!config || config.manualLeadSources.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: z.flattenError(parsed.error) }, { status: 400 });
  }
  const { name, source, note = "" } = parsed.data;
  const intentDef = parsed.data.intent
    ? crmKinds(config).find((i) => i.key.toLowerCase() === parsed.data.intent!.toLowerCase())
    : null;
  const intent = intentDef?.key ?? "";

  const phone = normalizeLeadPhone(parsed.data.phone);
  let status: number;
  let body: Record<string, unknown>;
  let waId: string | null = phone.ok ? phone.waId : null;

  if (!phone.ok) {
    status = 400;
    body = { error: "invalid_phone" };
  } else if (!config.manualLeadSources.some((s) => s.key === source)) {
    status = 400;
    body = { error: "invalid_source" };
  } else if (!intentDef) {
    status = 400;
    body = { error: "invalid_intent" };
  } else {
    try {
      const result = await createManualLead({
        waId: phone.waId,
        name,
        source,
        kind: intent,
        note,
        by: session.email,
      });
      if (result.ok) {
        status = 200;
        body = { ok: true, contactWaId: phone.waId, opportunityId: result.opportunityId };
      } else {
        // Same phone = same person: hand back the existing lead to open it.
        status = 409;
        body = { error: result.error, contactWaId: phone.waId };
      }
    } catch (err) {
      logger.error({ err, email: session.email }, "Manual lead creation failed");
      status = 500;
      body = { error: "internal_error" };
      waId = phone.waId;
    }
  }

  try {
    await db.insert(auditLog).values({
      email: session.email,
      action: "lead_create",
      metadata: {
        contact_wa_id: waId,
        source,
        ...(intent ? { intent } : {}),
        ok: status === 200,
        ...(status === 200 ? {} : { error: body.error }),
      },
    });
  } catch (err) {
    logger.error({ err }, "Lead create audit insert failed");
  }

  return NextResponse.json(body, { status });
}

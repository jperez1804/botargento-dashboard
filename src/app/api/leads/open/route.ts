// Opens an opportunity by hand for a person the dashboard already knows:
// "Nueva oportunidad" from their card, and the one-click button behind a
// "Consulta nueva" hint on the board. The bot opens its own through the
// read-time sync, never through here.
//
// Asesor or admin → CRM gate → Zod → the rubro must exist in the vertical →
// effect in dashboard.* → audit row (lead_open) written even when it fails.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/role-guard";
import { verticalConfig } from "@/config/verticals";
import { crmConfig } from "@/lib/crm/enabled";
import { openOpportunity } from "@/lib/queries/lead-writes";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";
import { logger } from "@/lib/logger";

const Body = z.object({
  contactWaId: z.string().regex(/^[0-9]{8,15}$/, "contactWaId must be 8-15 digits"),
  // A key from the vertical's intents; "" = no rubro yet.
  kind: z.string().trim().max(60),
  title: z.string().trim().max(80).optional(),
});

export async function POST(request: Request) {
  const auth = await requireRoleApi("asesor");
  if (auth.response) return auth.response;
  const { session } = auth;

  const config = crmConfig();
  if (!config) return NextResponse.json({ error: "not_found" }, { status: 404 });

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
  const { contactWaId, kind, title = "" } = parsed.data;

  let status: number;
  let body: Record<string, unknown>;
  let opportunityId: number | null = null;

  if (kind && !verticalConfig().intents.some((i) => i.key === kind)) {
    status = 400;
    body = { error: "invalid_kind" };
  } else {
    try {
      const result = await openOpportunity({ waId: contactWaId, kind, title, by: session.email });
      if (result.ok) {
        status = 200;
        opportunityId = result.id;
        body = { ok: true, opportunityId: result.id, seq: result.seq };
      } else {
        status = result.error === "opted_out" ? 409 : 404;
        body = { error: result.error };
      }
    } catch (err) {
      logger.error({ err, email: session.email }, "Opening an opportunity failed");
      status = 500;
      body = { error: "internal_error" };
    }
  }

  try {
    await db.insert(auditLog).values({
      email: session.email,
      action: "lead_open",
      metadata: {
        contact_wa_id: contactWaId,
        opportunity_id: opportunityId,
        kind,
        ok: status === 200,
        ...(status === 200 ? {} : { error: body.error }),
      },
    });
  } catch (err) {
    logger.error({ err }, "Lead open audit insert failed");
  }

  return NextResponse.json(body, { status });
}

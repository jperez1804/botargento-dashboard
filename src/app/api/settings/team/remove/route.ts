// Revoke a person's dashboard access. Admin-only, audited (team_remove).
// Their leads become unassigned; lead history is kept.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/role-guard";
import { removeTeamMember } from "@/lib/queries/team-writes";
import { invalidateCrmAlerts } from "@/lib/queries/leads";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";
import { logger } from "@/lib/logger";

const Body = z.object({
  email: z.email().max(254).transform((e) => e.trim().toLowerCase()),
});

export async function POST(request: Request) {
  const auth = await requireRoleApi("admin");
  if (auth.response) return auth.response;
  const { session } = auth;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { email } = parsed.data;

  try {
    const result = await removeTeamMember(email, session.email);
    await db.insert(auditLog).values({
      email: session.email,
      action: "team_remove",
      metadata: { target: email, ok: result.ok, ...(result.ok ? {} : { error: result.error }) },
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    invalidateCrmAlerts();
    return NextResponse.json({ ok: true, removed: result.removed });
  } catch (err) {
    logger.error({ err, email: session.email }, "Team remove failed");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

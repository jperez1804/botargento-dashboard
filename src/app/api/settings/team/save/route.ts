// Add or update a person: allowlist role + team directory (name, WhatsApp).
// Admin-only; every attempt is audited (team_save), including refusals.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/role-guard";
import { saveTeamMember } from "@/lib/queries/team-writes";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";
import { logger } from "@/lib/logger";

const Body = z.object({
  email: z.email().max(254).transform((e) => e.trim().toLowerCase()),
  role: z.enum(["admin", "asesor", "viewer"]),
  displayName: z.string().trim().max(80),
  // E.164 digits without '+', or empty for "no WhatsApp reminders".
  whatsappNumber: z.union([z.literal(""), z.string().regex(/^[0-9]{8,15}$/)]),
  notifyWhatsapp: z.boolean(),
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
    return NextResponse.json(
      { error: "invalid_body", issues: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    const result = await saveTeamMember(input, session.email);
    await db.insert(auditLog).values({
      email: session.email,
      action: "team_save",
      metadata: {
        target: input.email,
        role: input.role,
        ok: result.ok,
        ...(result.ok
          ? { created: result.created, previous_role: result.previousRole }
          : { error: result.error }),
      },
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, created: result.created });
  } catch (err) {
    logger.error({ err, email: session.email }, "Team save failed");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

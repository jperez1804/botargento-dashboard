// Add or update a person: allowlist role + team directory (name, WhatsApp).
// Admin-only; every attempt is audited (team_save), including refusals.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/role-guard";
import { normalizeLeadPhone } from "@/lib/crm/phone";
import { saveTeamMember } from "@/lib/queries/team-writes";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";
import { logger } from "@/lib/logger";

const Body = z.object({
  email: z.email().max(254).transform((e) => e.trim().toLowerCase()),
  role: z.enum(["admin", "asesor", "viewer"]),
  displayName: z.string().trim().max(80),
  // Whatever the admin typed; normalized below to the id WhatsApp uses.
  // '' = no WhatsApp reminders for this person.
  whatsappNumber: z.string().trim().max(40),
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
  // The number is what the CRM reminder workflow dials, so it goes through
  // the same normalizer as a lead's phone: "011 15 4444-7777" has to become
  // 5491144447777, not be stored as typed and then never reached.
  const phone = parsed.data.whatsappNumber ? normalizeLeadPhone(parsed.data.whatsappNumber) : null;
  if (phone && !phone.ok) {
    await db.insert(auditLog).values({
      email: session.email,
      action: "team_save",
      metadata: { target: parsed.data.email, role: parsed.data.role, ok: false, error: "invalid_phone" },
    });
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }
  const input = { ...parsed.data, whatsappNumber: phone?.ok ? phone.waId : "" };

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

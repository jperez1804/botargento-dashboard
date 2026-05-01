import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/role-guard";
import { updateAppSettings } from "@/lib/queries/app-settings";
import { logger } from "@/lib/logger";

// Validates against the same regex used by env() for CLIENT_PRIMARY_COLOR.
// Six-digit hex only — picker emits canonical form, no shortcut #abc.
const ThemeUpdateBody = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "primaryColor must be #rrggbb hex"),
});

export async function POST(request: Request) {
  // Throws redirect when caller is not admin; updateAppSettings will never run
  // for viewers/anon callers.
  const session = await requireRole("admin");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ThemeUpdateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const next = await updateAppSettings(
      { primaryColor: parsed.data.primaryColor },
      session.email,
    );
    return NextResponse.json({ ok: true, primaryColor: next.primaryColor });
  } catch (err) {
    logger.error({ err, email: session.email }, "Theme update failed");
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

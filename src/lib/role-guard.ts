// Server-only role enforcement, read from `dashboard.allowed_emails.role`.
//
// Roles are ranked viewer < asesor < admin:
//   - viewer: read-only (the default for any allowlisted email).
//   - asesor: manages leads (stage, owner, activities, reminders); no Settings,
//     no admin inbox.
//   - admin: everything.
//
// Pages / Server Components call `requireRole(min)` at the top. Failure modes:
//   - No session → redirect to /login (Auth.js convention).
//   - Session but email not in allowlist → treated as no session (defensive;
//     auth() already enforces the allowlist).
//   - Role below the minimum → redirect to / and audit-log `role_denied`.
//
// Route handlers call `requireRoleApi(min)` instead: a redirect inside a
// fetch() is followed silently and would read as a 200, so the API variant
// answers 401/403 JSON and lets the client show the error.

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { allowedEmails, auditLog } from "@/db/schema";
import { logger } from "@/lib/logger";

export type Role = "admin" | "asesor" | "viewer";

export const ROLES: ReadonlyArray<Role> = ["admin", "asesor", "viewer"];

const ROLE_RANK: Record<Role, number> = { viewer: 0, asesor: 1, admin: 2 };

export type SessionWithRole = {
  email: string;
  role: Role;
};

export function parseRole(value: string | null | undefined): Role {
  return value === "admin" || value === "asesor" ? value : "viewer";
}

export function hasRole(session: SessionWithRole, min: Role): boolean {
  return ROLE_RANK[session.role] >= ROLE_RANK[min];
}

/**
 * Returns the current session's email + role, or null when there is no
 * session. Use this for rendering decisions that need the role without
 * redirecting (e.g., which nav items to show).
 */
export async function getSessionRole(): Promise<SessionWithRole | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;

  const rows = await db
    .select({ role: allowedEmails.role })
    .from(allowedEmails)
    .where(eq(allowedEmails.email, email))
    .limit(1);

  const row = rows[0];
  // If the email isn't in the allowlist, treat as no session — auth() should
  // already have prevented this from happening.
  if (!row) return null;

  return { email, role: parseRole(row.role) };
}

async function auditDenial(session: SessionWithRole, required: Role): Promise<void> {
  logger.warn({ email: session.email, required, actual: session.role }, "Role denied");
  await db.insert(auditLog).values({
    email: session.email,
    action: "role_denied",
    metadata: { required, actual: session.role },
  });
}

/**
 * Enforces a minimum role for pages. Any allowlisted user passes
 * `requireRole("viewer")` without an audit row; denials are audited so
 * escalation attempts are visible in dashboard.audit_log.
 */
export async function requireRole(min: Role): Promise<SessionWithRole> {
  const session = await getSessionRole();
  if (!session) {
    // No session — bounce to login. Auth.js will preserve the callbackUrl.
    redirect("/login");
  }

  if (!hasRole(session, min)) {
    await auditDenial(session, min);
    redirect("/");
  }

  return session;
}

/**
 * Route-handler variant of requireRole: never redirects. Returns the session,
 * or a ready-to-return 401/403 JSON response.
 */
export async function requireRoleApi(
  min: Role,
): Promise<{ session: SessionWithRole; response?: never } | { session?: never; response: NextResponse }> {
  const session = await getSessionRole();
  if (!session) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!hasRole(session, min)) {
    await auditDenial(session, min);
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { session };
}

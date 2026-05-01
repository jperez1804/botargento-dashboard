// Server-only role enforcement. The first privileged surface (the /settings
// page in Phase B) needs to gate access to admins, so this is also the first
// time we read from `dashboard.allowed_emails.role` — until now the column
// existed but was unused.
//
// Pattern: Server Components / route handlers call `requireRole("admin")` at
// the top. Failure modes:
//   - No session → redirect to /login (Auth.js convention).
//   - Session but email not in allowlist → log + redirect to / (defensive;
//     should be impossible since auth() already enforces allowlist).
//   - Session with viewer role attempting admin action → redirect to / and
//     audit-log a denial so operators can spot escalation attempts.

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { allowedEmails, auditLog } from "@/db/schema";
import { logger } from "@/lib/logger";

export type Role = "admin" | "viewer";

export type SessionWithRole = {
  email: string;
  role: Role;
};

/**
 * Returns the current session's email + role. Redirects to /login if there is
 * no session. Use this for server-side rendering decisions that need the role
 * without throwing (e.g., conditionally rendering the Sidebar's settings nav
 * for admins only).
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

  const role: Role = row.role === "admin" ? "admin" : "viewer";
  return { email, role };
}

/**
 * Enforces a minimum role. Admin-required actions call `requireRole("admin")`;
 * pages that any authenticated user can see don't need to call this at all
 * (the proxy + Auth.js authorized() callback already gate them).
 *
 * Audits viewer→admin denials so escalation attempts are visible in
 * dashboard.audit_log just like login_denied entries.
 */
export async function requireRole(role: Role): Promise<SessionWithRole> {
  const session = await getSessionRole();
  if (!session) {
    // No session — bounce to login. Auth.js will preserve the callbackUrl.
    redirect("/login");
  }

  if (role === "admin" && session.role !== "admin") {
    logger.warn({ email: session.email }, "Admin action attempted by viewer");
    await db
      .insert(auditLog)
      .values({
        email: session.email,
        action: "role_denied",
        metadata: { required: role, actual: session.role },
      });
    redirect("/");
  }

  return session;
}

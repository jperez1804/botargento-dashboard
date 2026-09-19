// Configuración › Equipo writes. dashboard.* only. Access changes (who can log
// in, with which role) are auth-relevant: callers are admin-only route
// handlers that audit every attempt.

import type { Sql, TransactionSql } from "postgres";
import { sql } from "@/db/client";
import type { Role } from "@/lib/role-guard";

export type TeamMemberInput = {
  email: string;
  role: Role;
  displayName: string;
  whatsappNumber: string;
  notifyWhatsapp: boolean;
};

export type TeamWriteError = "cannot_change_self" | "last_admin";

async function adminCount(tx: Sql | TransactionSql) {
  const rows = await tx<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM dashboard.allowed_emails WHERE role = 'admin'
  `;
  return Number(rows[0]?.n ?? 0);
}

/**
 * Adds a person to the allowlist (or updates them) together with their team
 * directory row. Returns an error code instead of writing when the change
 * would lock the tenant out of administration.
 */
export async function saveTeamMember(
  input: TeamMemberInput,
  by: string,
): Promise<{ ok: true; created: boolean; previousRole: Role | null } | { ok: false; error: TeamWriteError }> {
  return sql.begin(async (tx) => {
    const existing = await tx<{ role: string }[]>`
      SELECT role FROM dashboard.allowed_emails WHERE email = ${input.email} FOR UPDATE
    `;
    const previousRole = existing[0] ? (existing[0].role as Role) : null;

    if (previousRole !== null && previousRole !== input.role) {
      if (input.email === by) return { ok: false as const, error: "cannot_change_self" as const };
      if (previousRole === "admin" && (await adminCount(tx)) <= 1) {
        return { ok: false as const, error: "last_admin" as const };
      }
    }

    await tx`
      INSERT INTO dashboard.allowed_emails (email, role, created_by)
      VALUES (${input.email}, ${input.role}, ${by})
      ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
    `;
    await tx`
      INSERT INTO dashboard.team_members
        (email, display_name, whatsapp_number, notify_whatsapp, updated_at, updated_by)
      VALUES (${input.email}, ${input.displayName}, ${input.whatsappNumber},
              ${input.notifyWhatsapp}, NOW(), ${by})
      ON CONFLICT (email) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          whatsapp_number = EXCLUDED.whatsapp_number,
          notify_whatsapp = EXCLUDED.notify_whatsapp,
          updated_at = NOW(),
          updated_by = EXCLUDED.updated_by
    `;
    return { ok: true as const, created: previousRole === null, previousRole };
  });
}

/**
 * Revokes dashboard access. The team row cascades away and any leads they
 * owned become unassigned (FK ON DELETE SET NULL); their history stays.
 */
export async function removeTeamMember(
  email: string,
  by: string,
): Promise<{ ok: true; removed: boolean } | { ok: false; error: TeamWriteError }> {
  if (email === by) return { ok: false, error: "cannot_change_self" };
  return sql.begin(async (tx) => {
    const rows = await tx<{ role: string }[]>`
      SELECT role FROM dashboard.allowed_emails WHERE email = ${email} FOR UPDATE
    `;
    if (!rows[0]) return { ok: true as const, removed: false };
    if (rows[0].role === "admin" && (await adminCount(tx)) <= 1) {
      return { ok: false as const, error: "last_admin" as const };
    }
    await tx`DELETE FROM dashboard.allowed_emails WHERE email = ${email}`;
    return { ok: true as const, removed: true };
  });
}

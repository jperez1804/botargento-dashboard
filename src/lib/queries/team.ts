// Team directory reads: who can log in (dashboard.allowed_emails), with which
// role, and the optional display name + WhatsApp from dashboard.team_members.

import { sql } from "@/db/client";
import { parseRole, type Role } from "@/lib/role-guard";

export type TeamMember = {
  email: string;
  role: Role;
  displayName: string;
  whatsappNumber: string;
  notifyWhatsapp: boolean;
  active: boolean;
};

function mapMember(r: Record<string, unknown>): TeamMember {
  return {
    email: String(r.email),
    role: parseRole(String(r.role ?? "")),
    displayName: String(r.display_name ?? ""),
    whatsappNumber: String(r.whatsapp_number ?? ""),
    notifyWhatsapp: r.notify_whatsapp !== false,
    active: r.active !== false,
  };
}

/** Every allowlisted email, for Configuración › Equipo. */
export async function listTeam(): Promise<TeamMember[]> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT a.email, a.role, t.display_name, t.whatsapp_number, t.notify_whatsapp, t.active
    FROM dashboard.allowed_emails a
    LEFT JOIN dashboard.team_members t ON t.email = a.email
    ORDER BY a.role = 'admin' DESC, a.role = 'asesor' DESC, a.email
  `;
  return rows.map(mapMember);
}

/**
 * People a lead can be assigned to: admins and asesores that are not
 * deactivated in the team directory. Viewers are read-only, so they never own
 * a lead.
 */
export async function listAssignableMembers(): Promise<TeamMember[]> {
  const members = await listTeam();
  return members.filter((m) => m.role !== "viewer" && m.active);
}

/** Display name for an owner email, falling back to the email itself. */
export function memberLabel(members: ReadonlyArray<TeamMember>, email: string | null): string {
  if (!email) return "";
  const m = members.find((x) => x.email === email);
  return m?.displayName || email;
}

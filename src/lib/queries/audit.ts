// Read path for the dashboard.audit_log table. Currently the only writer is
// updateAppSettings(theme_update); as more privileged actions land (role
// changes, vertical config edits, etc.) they should write here with
// consistent metadata shapes so this query continues to work.

import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";

export type AuditEntry = {
  id: number;
  email: string | null;
  action: string;
  metadata: unknown;
  createdAt: string; // ISO string for serialization
};

export async function listAuditEntries(limit = 100): Promise<AuditEntry[]> {
  const rows = await db
    .select({
      id: auditLog.id,
      email: auditLog.email,
      action: auditLog.action,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    action: r.action,
    metadata: r.metadata,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }));
}

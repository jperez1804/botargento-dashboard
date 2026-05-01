// Read + write paths for the single-row tenant settings table backing the
// /settings page. Layout reads from `getAppSettings()` to inject the runtime
// `--client-primary` CSS var; the /api/settings/theme endpoint writes via
// `updateAppSettings()` which also drops a row in `dashboard.audit_log`.

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { appSettings, auditLog } from "@/db/schema";
import { env } from "@/lib/env";

export type AppSettings = {
  primaryColor: string;
};

const SETTINGS_ROW_ID = 1;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Reads the single settings row. Falls back to the CLIENT_PRIMARY_COLOR env
 * var when the row does not exist yet — defensive only; migration 0002 seeds
 * the row at deploy time so post-deploy this branch never fires in practice.
 */
export async function getAppSettings(): Promise<AppSettings> {
  const rows = await db
    .select({ primaryColor: appSettings.primaryColor })
    .from(appSettings)
    .where(eq(appSettings.id, SETTINGS_ROW_ID))
    .limit(1);

  const row = rows[0];
  if (row && row.primaryColor) {
    return { primaryColor: row.primaryColor };
  }

  return { primaryColor: env().CLIENT_PRIMARY_COLOR };
}

/**
 * Persists a new primary color. Validates the hex format defensively (the
 * route handler should have already done this; we don't trust callers to keep
 * invariants on a privileged write path). Audits the change in
 * `dashboard.audit_log` with the prior value so an operator can reconstruct
 * who-changed-what-when.
 */
export async function updateAppSettings(
  next: AppSettings,
  by: string,
): Promise<AppSettings> {
  if (!HEX_COLOR_RE.test(next.primaryColor)) {
    throw new Error(`Invalid hex color: ${next.primaryColor}`);
  }
  if (!by || !by.trim()) {
    throw new Error("updateAppSettings requires a non-empty `by` (acting user)");
  }

  const previous = await getAppSettings();

  await db
    .insert(appSettings)
    .values({
      id: SETTINGS_ROW_ID,
      primaryColor: next.primaryColor,
      updatedBy: by,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: {
        primaryColor: next.primaryColor,
        updatedBy: by,
        updatedAt: new Date(),
      },
    });

  await db.insert(auditLog).values({
    email: by,
    action: "theme_update",
    metadata: { from: previous.primaryColor, to: next.primaryColor },
  });

  return { primaryColor: next.primaryColor };
}

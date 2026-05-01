import { pgSchema, text, timestamp, bigserial, jsonb, smallint } from "drizzle-orm/pg-core";

export const dashboardSchema = pgSchema("dashboard");

export const allowedEmails = dashboardSchema.table("allowed_emails", {
  email: text("email").primaryKey(),
  role: text("role").notNull().default("viewer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by"),
});

export const magicLinkTokens = dashboardSchema.table("magic_link_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = dashboardSchema.table("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  email: text("email"),
  action: text("action").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Single-row table — id is locked to 1 by a CHECK constraint at the DB level
// (see migrations/0002_app_settings.sql). Backs the /settings page.
export const appSettings = dashboardSchema.table("app_settings", {
  id: smallint("id").primaryKey().default(1),
  primaryColor: text("primary_color").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by").notNull(),
});

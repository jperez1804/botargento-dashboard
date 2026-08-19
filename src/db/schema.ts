import { pgSchema, text, timestamp, bigserial, bigint, jsonb, smallint } from "drizzle-orm/pg-core";

export const dashboardSchema = pgSchema("dashboard");

// Two-way inbox read tracking (see migrations/0004_inbox_read_state.sql).
// Dashboard-side state: opening /inbox/[waId] advances last_read_log_id.
export const inboxReadState = dashboardSchema.table("inbox_read_state", {
  contactWaId: text("contact_wa_id").primaryKey(),
  lastReadLogId: bigint("last_read_log_id", { mode: "number" }).notNull().default(0),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  readBy: text("read_by").notNull().default(""),
});

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

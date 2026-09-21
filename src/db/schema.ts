import {
  pgSchema,
  text,
  timestamp,
  bigserial,
  bigint,
  jsonb,
  smallint,
  boolean,
} from "drizzle-orm/pg-core";

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

// CRM-lite (see migrations/0005_crm_leads.sql). Reads go through raw `sql` in
// src/lib/queries/leads.ts like the rest of the app; these definitions exist
// for typed inserts.
export const teamMembers = dashboardSchema.table("team_members", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull().default(""),
  whatsappNumber: text("whatsapp_number").notNull().default(""),
  notifyWhatsapp: boolean("notify_whatsapp").notNull().default(true),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by").notNull().default(""),
});

export const leadState = dashboardSchema.table("lead_state", {
  contactWaId: text("contact_wa_id").primaryKey(),
  stage: text("stage"),
  stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }),
  stageChangedBy: text("stage_changed_by").notNull().default(""),
  lostReason: text("lost_reason").notNull().default(""),
  ownerEmail: text("owner_email"),
  ownerAssignedAt: timestamp("owner_assigned_at", { withTimezone: true }),
  ownerAssignedBy: text("owner_assigned_by").notNull().default(""),
  nextActionAt: timestamp("next_action_at", { withTimezone: true }),
  nextActionNote: text("next_action_note").notNull().default(""),
  nextActionSetBy: text("next_action_set_by").notNull().default(""),
  nextActionNotifiedAt: timestamp("next_action_notified_at", { withTimezone: true }),
  nextActionDoneAt: timestamp("next_action_done_at", { withTimezone: true }),
  // Manual priority (migrations/0007_lead_priority.sql): '' | alta | media | baja.
  priority: text("priority").notNull().default(""),
  prioritySetAt: timestamp("priority_set_at", { withTimezone: true }),
  prioritySetBy: text("priority_set_by").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Leads registered by hand (migrations/0006_manual_leads.sql), keyed by the
// same contact_wa_id WhatsApp uses.
export const manualLeads = dashboardSchema.table("manual_leads", {
  contactWaId: text("contact_wa_id").primaryKey(),
  displayName: text("display_name").notNull(),
  source: text("source").notNull(),
  createdBy: text("created_by").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leadEvents = dashboardSchema.table("lead_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  contactWaId: text("contact_wa_id").notNull(),
  kind: text("kind").notNull(),
  body: text("body").notNull().default(""),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by").notNull().default(""),
  metadata: jsonb("metadata").notNull().default({}),
});

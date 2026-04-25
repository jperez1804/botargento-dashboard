// Minimal Auth.js adapter that backs the magic-link flow with
// dashboard.magic_link_tokens. We intentionally keep no users / sessions /
// accounts tables: session strategy is JWT, and the allowlist is the user
// table. Synthetic user objects are returned for email identifiers so
// Auth.js's email-provider flow has something to hand through.
//
// Tokens are stored SHA-256 hashed. useVerificationToken is the single
// security-critical path: it re-checks the allowlist, enforces single-use via
// consumed_at, and checks expiry.

import type { Adapter, AdapterUser } from "@auth/core/adapters";
import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { allowedEmails, auditLog, magicLinkTokens } from "@/db/schema";

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function syntheticUser(email: string): AdapterUser {
  return { id: email, email, emailVerified: null };
}

async function isAllowed(email: string): Promise<boolean> {
  const rows = await db
    .select({ email: allowedEmails.email })
    .from(allowedEmails)
    .where(eq(allowedEmails.email, email))
    .limit(1);
  return rows.length > 0;
}

export function dashboardAdapter(): Adapter {
  return {
    // ── User lifecycle (synthetic — allowlist IS the user table) ──────────
    async createUser(user) {
      const email = user.email?.toLowerCase() ?? "";
      return syntheticUser(email);
    },
    async getUser(id) {
      return (await isAllowed(id.toLowerCase())) ? syntheticUser(id.toLowerCase()) : null;
    },
    async getUserByEmail(email) {
      const normalized = email.toLowerCase();
      return (await isAllowed(normalized)) ? syntheticUser(normalized) : null;
    },
    async getUserByAccount() {
      return null;
    },
    async updateUser(user) {
      const email = user.email?.toLowerCase() ?? user.id;
      return syntheticUser(email);
    },
    async deleteUser() {
      return;
    },

    // ── Account / session no-ops (JWT strategy, no OAuth) ─────────────────
    async linkAccount() {
      return;
    },
    async unlinkAccount() {
      return;
    },

    // ── Verification tokens (the only real-storage path) ──────────────────
    async createVerificationToken(vt) {
      const identifier = vt.identifier.toLowerCase();
      await db
        .insert(magicLinkTokens)
        .values({
          tokenHash: hash(vt.token),
          email: identifier,
          expiresAt: vt.expires,
        })
        .onConflictDoNothing();
      return { identifier, token: vt.token, expires: vt.expires };
    },

    async useVerificationToken({ identifier, token }) {
      const tokenHash = hash(token);
      const normalized = identifier.toLowerCase();

      const rows = await db
        .select()
        .from(magicLinkTokens)
        .where(and(eq(magicLinkTokens.tokenHash, tokenHash), isNull(magicLinkTokens.consumedAt)))
        .limit(1);

      const row = rows[0];
      if (!row) return null;
      if (row.email !== normalized) return null;
      if (row.expiresAt < new Date()) return null;

      if (!(await isAllowed(normalized))) return null;

      await db
        .update(magicLinkTokens)
        .set({ consumedAt: new Date() })
        .where(eq(magicLinkTokens.tokenHash, tokenHash));

      await db.insert(auditLog).values({ email: row.email, action: "login" });

      return { identifier: row.email, token, expires: row.expiresAt };
    },
  };
}

import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { allowedEmails, auditLog } from "@/db/schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { dashboardAdapter } from "@/lib/db-adapter";
import { renderMagicLinkEmail } from "@/lib/email";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env().AUTH_SECRET,
  adapter: dashboardAdapter(),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login", verifyRequest: "/login?sent=1" },
  trustHost: true,
  providers: [
    Resend({
      apiKey: env().RESEND_API_KEY,
      from: env().AUTH_EMAIL_FROM,
      async sendVerificationRequest({ identifier, url, provider }) {
        const email = identifier.toLowerCase();

        const allowed = await db
          .select()
          .from(allowedEmails)
          .where(eq(allowedEmails.email, email))
          .limit(1);

        if (allowed.length === 0) {
          await db.insert(auditLog).values({
            email,
            action: "login_denied",
            metadata: { reason: "not_in_allowlist" },
          });
          logger.warn({ email }, "Magic link requested for non-allowlisted email");
          return; // silent: do not reveal allowlist membership
        }

        // Dev short-circuit: print URL to terminal instead of hitting Resend.
        // The Reglas ban process.env.X in feature code, but NODE_ENV is read
        // through the validated env() loader.
        if (env().NODE_ENV !== "production") {
          // Console log so it shows up even if pino is filtered
          // eslint-disable-next-line no-console
          console.log(`\n→ Magic link for ${email}:\n  ${url}\n`);
          logger.info({ email }, "Magic link (dev mode) — URL logged to terminal");
          return;
        }

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: provider.from,
            to: email,
            subject: `Acceso a ${env().CLIENT_NAME}`,
            html: renderMagicLinkEmail({ url, clientName: env().CLIENT_NAME }),
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          logger.error({ email, status: res.status, body }, "Resend API error");
          throw new Error(`Resend API error (${res.status})`);
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      const allowed = await db
        .select()
        .from(allowedEmails)
        .where(eq(allowedEmails.email, email))
        .limit(1);
      if (allowed.length === 0) {
        await db
          .insert(auditLog)
          .values({ email, action: "login_denied", metadata: { reason: "signin_callback" } });
        return false;
      }
      // `login` is written inside the adapter's useVerificationToken — only
      // after the token is successfully consumed. signIn fires before that
      // for the email provider (it gates whether the email is sent at all).
      return true;
    },
    async jwt({ token }) {
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email;
      }
      return session;
    },
  },
});

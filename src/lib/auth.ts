import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { allowedEmails, auditLog } from "@/db/schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { dashboardAdapter } from "@/lib/db-adapter";
import { renderMagicLinkEmail } from "@/lib/email";

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const runtimeEnv = env();

  return {
    secret: runtimeEnv.AUTH_SECRET,
    adapter: dashboardAdapter(),
    session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
    pages: { signIn: "/login", verifyRequest: "/login?sent=1" },
    trustHost: true,
    providers: [
      Resend({
        apiKey: runtimeEnv.RESEND_API_KEY,
        from: runtimeEnv.AUTH_EMAIL_FROM,
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
            return;
          }

          // Dev short-circuit: print the URL instead of calling Resend.
          if (runtimeEnv.NODE_ENV !== "production") {
            console.log(`\n-> Magic link for ${email}:\n  ${url}\n`);
            logger.info({ email }, "Magic link (dev mode) - URL logged to terminal");
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
              subject: `Acceso a ${runtimeEnv.CLIENT_NAME}`,
              html: renderMagicLinkEmail({ url, clientName: runtimeEnv.CLIENT_NAME }),
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
      authorized({ auth: session }) {
        // Returning false makes NextAuth redirect unauthenticated requests
        // to the configured signIn page (/login). The proxy matcher already
        // excludes /login, /verify, /api/auth, _next, etc.
        return !!session;
      },
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

        // `login` is written inside the adapter's useVerificationToken, only
        // after the token is successfully consumed.
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
  };
});

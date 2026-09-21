import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { dashboardAdapter, isEmailAllowed } from "@/lib/db-adapter";
import { renderMagicLinkEmail } from "@/lib/email";
import { decideSignIn } from "@/lib/login-flow";

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
        // Only ever reached for allowlisted emails: callbacks.signIn runs
        // BEFORE this on a link request and short-circuits everyone else (see
        // lib/login-flow). No allowlist logic here on purpose — the old silent
        // "don't send, don't tell" branch was unreachable and contradicted it.
        async sendVerificationRequest({ identifier, url, provider }) {
          const email = identifier.toLowerCase();

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
      // The allowlist gate, for both steps of the magic link:
      //   - link request (verificationRequest): a non-allowlisted email gets
      //     a redirect back to /login?error=not_allowed — a readable message,
      //     no token, no email. (Returning false here made Auth.js throw
      //     AccessDenied and the login form answered HTTP 500.)
      //   - link click: false → AccessDenied, never a session.
      // Both denials are audited as login_denied. `login` itself is written in
      // the adapter's useVerificationToken, after the token is consumed.
      async signIn({ user, email }) {
        return decideSignIn(
          { email: user.email, verificationRequest: email?.verificationRequest === true },
          {
            isAllowed: isEmailAllowed,
            audit: async (address, reason) => {
              logger.warn({ email: address, reason }, "Login denied: email not in allowlist");
              await db
                .insert(auditLog)
                .values({ email: address, action: "login_denied", metadata: { reason } });
            },
          },
        );
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

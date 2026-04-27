// Next 16 replaces the `middleware` convention with `proxy`. We run on the
// Node.js runtime so the auth config can share node:crypto / postgres.js with
// the rest of the app without maintaining a separate edge-safe subset.

// Canonical NextAuth v5 pattern: re-export `auth` as the proxy/middleware.
// The gating logic (allow vs redirect-to-signin) lives in the `authorized`
// callback in src/lib/auth.ts so it has access to NextAuth's session
// resolution before the response is built.
export { auth as proxy } from "@/lib/auth";

export const config = {
  matcher: ["/((?!api/auth|_next|favicon.ico|logos|login|verify).*)"],
};

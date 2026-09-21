// Magic-link login decisions, kept free of Next/Auth.js imports so they can be
// unit-tested with injected dependencies.
//
// How Auth.js (@auth/core 0.41, via next-auth 5.0.0-beta.31) runs the email
// provider — verified against the installed source, not assumed:
//   1. Link REQUEST (POST /signin/resend): callbacks.signIn runs FIRST with
//      `email.verificationRequest === true`. `false` → AccessDenied thrown
//      (the server action surfaced it as an HTTP 500). A string → redirect to
//      that URL: no token is created and no email is sent.
//   2. Link CLICK (GET /callback/resend): callbacks.signIn runs again without
//      `verificationRequest`; `false` → AccessDenied, no session.
// So the allowlist gate lives in signIn: a readable redirect on the request,
// the hard denial on the click.

export const NOT_ALLOWED_ERROR = "not_allowed";
export const NOT_ALLOWED_PATH = `/login?error=${NOT_ALLOWED_ERROR}`;

export type LoginError = "missing" | "not_allowed" | "unknown";

/** Trim + lowercase, the same normalization the allowlist is stored with. */
export function normalizeEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/**
 * Where to land after login, reduced to a same-origin path. The proxy sends
 * an ABSOLUTE callbackUrl (https://dashboard.<tenant>…/handoffs); keeping only
 * path + query + hash drops any foreign origin, so this can never become an
 * open redirect. Auth pages fall back to "/".
 */
export function safeCallbackPath(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim() === "") return "/";
  let path: string;
  try {
    const url = new URL(raw, "http://placeholder.invalid");
    path = `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  if (path.startsWith("/login") || path.startsWith("/verify") || path.startsWith("/api/auth")) {
    return "/";
  }
  return path;
}

/** Back to the login form with an error, keeping where the user was headed. */
export function loginErrorUrl(
  error: LoginError,
  opts: { callbackPath?: string; email?: string } = {},
): string {
  const params = new URLSearchParams({ error });
  if (opts.callbackPath && opts.callbackPath !== "/") params.set("callbackUrl", opts.callbackPath);
  // Echo the address so a typo can be fixed in place instead of retyped.
  if (opts.email) params.set("email", opts.email);
  return `/login?${params.toString()}`;
}

/** Did Auth.js answer the link request with our not-allowed redirect? */
export function isNotAllowedRedirect(url: string): boolean {
  try {
    const parsed = new URL(url, "http://placeholder.invalid");
    return parsed.pathname === "/login" && parsed.searchParams.get("error") === NOT_ALLOWED_ERROR;
  } catch {
    return false;
  }
}

export type SignInDeps = {
  isAllowed: (email: string) => Promise<boolean>;
  audit: (email: string, reason: "not_in_allowlist" | "signin_callback") => Promise<void>;
};

/**
 * Body of Auth.js's signIn callback. Returns true (allowed), a redirect path
 * (denied while REQUESTING a link — readable error, nothing sent), or false
 * (denied while CLICKING a link — hard AccessDenied, never a session).
 */
export async function decideSignIn(
  input: { email: string | null | undefined; verificationRequest: boolean },
  deps: SignInDeps,
): Promise<boolean | string> {
  const email = normalizeEmail(input.email);
  if (email && (await deps.isAllowed(email))) return true;

  if (email) {
    await deps.audit(email, input.verificationRequest ? "not_in_allowlist" : "signin_callback");
  }
  return input.verificationRequest ? NOT_ALLOWED_PATH : false;
}

/**
 * Body of the /login server action: normalize, ask Auth.js to send the link
 * WITHOUT letting it redirect, and turn every outcome into a URL to redirect
 * to. Never throws — an unexpected Auth.js error becomes ?error=unknown
 * instead of a server-error page.
 */
export async function resolveLinkRequest(
  input: { email: unknown; callbackUrl: unknown },
  sendLink: (email: string, redirectTo: string) => Promise<string>,
  onError: (err: unknown) => void = () => {},
): Promise<string> {
  const email = normalizeEmail(input.email);
  const callbackPath = safeCallbackPath(input.callbackUrl);
  if (!email) return loginErrorUrl("missing", { callbackPath });

  let next: string;
  try {
    next = await sendLink(email, callbackPath);
  } catch (err) {
    onError(err);
    return loginErrorUrl("unknown", { callbackPath, email });
  }
  if (isNotAllowedRedirect(next)) return loginErrorUrl("not_allowed", { callbackPath, email });
  return next;
}

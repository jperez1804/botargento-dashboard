// Magic-link login decisions (src/lib/login-flow). Covers the plec bug of
// 2026-09-20: a typo'd, non-allowlisted email must land back on /login with a
// readable error — never AccessDenied / HTTP 500 — while the link click keeps
// the hard denial.

import { describe, expect, it, vi } from "vitest";
import {
  NOT_ALLOWED_PATH,
  decideSignIn,
  isNotAllowedRedirect,
  loginErrorUrl,
  normalizeEmail,
  resolveLinkRequest,
  safeCallbackPath,
} from "@/lib/login-flow";

const ALLOWED = new Set(["dev@botargento.com.ar"]);

function deps() {
  return {
    isAllowed: vi.fn(async (email: string) => ALLOWED.has(email)),
    audit: vi.fn(async () => undefined),
  };
}

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Dev@BotArgento.com.AR ")).toBe("dev@botargento.com.ar");
  });

  it("treats non-strings as empty", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
  });
});

describe("safeCallbackPath", () => {
  it("keeps a same-origin path with its query", () => {
    expect(safeCallbackPath("/handoffs?page=2")).toBe("/handoffs?page=2");
  });

  it("reduces the proxy's absolute callbackUrl to its path", () => {
    expect(safeCallbackPath("https://dashboard.plec.botargento.com.ar/handoffs")).toBe("/handoffs");
  });

  it("never becomes an open redirect", () => {
    expect(safeCallbackPath("https://evil.example/steal")).toBe("/steal");
    expect(safeCallbackPath("//evil.example/steal")).toBe("/steal");
  });

  it("falls back to / for empty input and auth pages", () => {
    expect(safeCallbackPath("")).toBe("/");
    expect(safeCallbackPath(null)).toBe("/");
    expect(safeCallbackPath("/login?error=not_allowed")).toBe("/");
    expect(safeCallbackPath("/api/auth/signin")).toBe("/");
  });
});

describe("decideSignIn", () => {
  it("allows an allowlisted email on both steps", async () => {
    const d = deps();
    expect(await decideSignIn({ email: "dev@botargento.com.ar", verificationRequest: true }, d)).toBe(true);
    expect(await decideSignIn({ email: "dev@botargento.com.ar", verificationRequest: false }, d)).toBe(true);
    expect(d.audit).not.toHaveBeenCalled();
  });

  it("normalizes before checking the allowlist", async () => {
    const d = deps();
    const result = await decideSignIn({ email: "  DEV@BotArgento.com.ar ", verificationRequest: true }, d);
    expect(result).toBe(true);
    expect(d.isAllowed).toHaveBeenCalledWith("dev@botargento.com.ar");
  });

  it("answers a link REQUEST with the not-allowed redirect (no AccessDenied) and audits it", async () => {
    const d = deps();
    const result = await decideSignIn({ email: "plec.arq@gmail.con", verificationRequest: true }, d);
    expect(result).toBe(NOT_ALLOWED_PATH);
    expect(d.audit).toHaveBeenCalledWith("plec.arq@gmail.con", "not_in_allowlist");
  });

  it("keeps the hard denial on the link CLICK and audits it", async () => {
    const d = deps();
    const result = await decideSignIn({ email: "etaramburelli@gamil.com", verificationRequest: false }, d);
    expect(result).toBe(false);
    expect(d.audit).toHaveBeenCalledWith("etaramburelli@gamil.com", "signin_callback");
  });

  it("denies a missing email without auditing an empty address", async () => {
    const d = deps();
    expect(await decideSignIn({ email: null, verificationRequest: false }, d)).toBe(false);
    expect(await decideSignIn({ email: "", verificationRequest: true }, d)).toBe(NOT_ALLOWED_PATH);
    expect(d.audit).not.toHaveBeenCalled();
  });
});

describe("resolveLinkRequest (the /login server action)", () => {
  it("allowlisted: sends the link and follows Auth.js to the 'check your email' page", async () => {
    const sendLink = vi.fn(async () => "http://localhost:3000/login?sent=1?provider=resend&type=email");
    const target = await resolveLinkRequest({ email: "dev@botargento.com.ar", callbackUrl: "" }, sendLink);
    expect(sendLink).toHaveBeenCalledWith("dev@botargento.com.ar", "/");
    expect(target).toContain("/login?sent=1");
  });

  it("normalizes the typed email before sending", async () => {
    const sendLink = vi.fn(async () => "/login?sent=1");
    await resolveLinkRequest({ email: "  Dev@BotArgento.com.ar ", callbackUrl: "" }, sendLink);
    expect(sendLink).toHaveBeenCalledWith("dev@botargento.com.ar", "/");
  });

  it("not allowlisted: back to /login with the error, the typed email and the deep link", async () => {
    const sendLink = vi.fn(async () => `http://localhost:3000${NOT_ALLOWED_PATH}`);
    const target = await resolveLinkRequest(
      {
        email: "plec.arq@gmail.con",
        callbackUrl: "https://dashboard.plec.botargento.com.ar/handoffs",
      },
      sendLink,
    );
    expect(sendLink).toHaveBeenCalledWith("plec.arq@gmail.con", "/handoffs");
    expect(target).toBe(
      loginErrorUrl("not_allowed", { callbackPath: "/handoffs", email: "plec.arq@gmail.con" }),
    );
    const params = new URL(target, "http://x").searchParams;
    expect(params.get("error")).toBe("not_allowed");
    expect(params.get("callbackUrl")).toBe("/handoffs");
    expect(params.get("email")).toBe("plec.arq@gmail.con");
  });

  it("never throws: an unexpected Auth.js error becomes ?error=unknown", async () => {
    const onError = vi.fn();
    const sendLink = vi.fn(async () => {
      throw new Error("AccessDenied");
    });
    const target = await resolveLinkRequest(
      { email: "dev@botargento.com.ar", callbackUrl: "/handoffs" },
      sendLink,
      onError,
    );
    expect(target).toContain("error=unknown");
    expect(onError).toHaveBeenCalledOnce();
  });

  it("empty email short-circuits without calling Auth.js", async () => {
    const sendLink = vi.fn(async () => "/login?sent=1");
    const target = await resolveLinkRequest({ email: "   ", callbackUrl: null }, sendLink);
    expect(target).toBe("/login?error=missing");
    expect(sendLink).not.toHaveBeenCalled();
  });
});

describe("isNotAllowedRedirect", () => {
  it("recognizes only the login error redirect", () => {
    expect(isNotAllowedRedirect(`https://x.y${NOT_ALLOWED_PATH}`)).toBe(true);
    expect(isNotAllowedRedirect("https://x.y/login?sent=1")).toBe(false);
    expect(isNotAllowedRedirect("https://x.y/handoffs?error=not_allowed")).toBe(false);
  });
});

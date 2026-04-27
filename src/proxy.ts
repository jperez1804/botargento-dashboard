// Next 16 replaces the `middleware` convention with `proxy`. We run on the
// Node.js runtime so the auth config can share node:crypto / postgres.js with
// the rest of the app without maintaining a separate edge-safe subset.

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const handler = auth((req) => {
  if (req.auth) return NextResponse.next();
  const loginUrl = new URL("/login", req.nextUrl);
  const { pathname, search } = req.nextUrl;
  if (pathname !== "/" && pathname !== "/login") {
    loginUrl.searchParams.set("callbackUrl", pathname + search);
  }
  return NextResponse.redirect(loginUrl);
});

// Next 16's proxy convention requires a named `proxy` export (or a default
// function). `auth(fn)` returns a non-function callable, so we wrap it.
export function proxy(...args: Parameters<typeof handler>) {
  return (handler as (...a: Parameters<typeof handler>) => ReturnType<typeof handler>)(...args);
}

export const config = {
  matcher: ["/((?!api/auth|_next|favicon.ico|logos|login|verify).*)"],
};

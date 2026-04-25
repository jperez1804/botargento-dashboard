// Next 16 replaces the `middleware` convention with `proxy`. We run on the
// Node.js runtime so the auth config can share node:crypto / postgres.js with
// the rest of the app without maintaining a separate edge-safe subset.

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  if (req.auth) return NextResponse.next();
  const loginUrl = new URL("/login", req.nextUrl);
  const { pathname, search } = req.nextUrl;
  if (pathname !== "/" && pathname !== "/login") {
    loginUrl.searchParams.set("callbackUrl", pathname + search);
  }
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/((?!api/auth|_next|favicon.ico|logos|login|verify).*)"],
};

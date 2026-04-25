// Fallback page. Auth.js verifies magic-link tokens at
// /api/auth/callback/resend, so in practice users never land here — but if a
// link is mis-wired or bookmarked, we show a neutral loading state and bounce
// to the login screen.

import Link from "next/link";

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4 py-12">
      <div className="max-w-sm space-y-4 text-center">
        <p className="text-sm text-muted-foreground">Verificando acceso…</p>
        <p className="text-sm">
          Si no te redirige en unos segundos,{" "}
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            volvé a ingresar
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

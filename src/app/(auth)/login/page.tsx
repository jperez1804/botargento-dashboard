import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { resolveLinkRequest, safeCallbackPath } from "@/lib/login-flow";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function requestLink(formData: FormData) {
  "use server";
  // signIn triggers Auth.js's resend flow with `redirect: false`, so it
  // RETURNS the next URL instead of redirecting (or throwing a 500 page):
  //   - allowlisted: token stored hashed in dashboard.magic_link_tokens,
  //     email sent via Resend (dev: URL logged), next = /login?sent=1
  //   - not allowlisted: the signIn callback answers /login?error=not_allowed
  //     (no token, no email) and we keep the typed email + deep link on it
  // The magic link carries the original deep link as its callbackUrl.
  const target = await resolveLinkRequest(
    { email: formData.get("email"), callbackUrl: formData.get("callbackUrl") },
    (email, redirectTo) => signIn("resend", { email, redirectTo, redirect: false }),
    (err) => logger.error({ err }, "Magic link request failed"),
  );
  redirect(target);
}

type PageProps = {
  searchParams: Promise<{ sent?: string; error?: string; callbackUrl?: string; email?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const { sent, error, callbackUrl, email } = await searchParams;
  const callbackPath = safeCallbackPath(callbackUrl);
  const clientName = env().CLIENT_NAME;
  // Auth.js 5.0.0-beta.31 concatenates verifyRequest query params onto
  // pages.verifyRequest, producing URLs like `/login?sent=1?provider=resend`.
  // Treat any truthy `sent` as the confirmation state.
  const emailSent = Boolean(sent);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-xl font-semibold">{clientName}</CardTitle>
          <CardDescription>
            {emailSent
              ? "Te enviamos un link a tu correo."
              : "Ingresá tu email y te enviaremos un link de acceso."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailSent ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                El link es de un solo uso y vence en 15 minutos. Revisá tu bandeja de entrada
                (y la carpeta de spam por las dudas).
              </p>
              <p>
                <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                  Enviar otro link
                </Link>
              </p>
            </div>
          ) : (
            <form action={requestLink} className="space-y-4">
              {/* Deep link the user was bounced from (e.g. /handoffs): the
                  magic link sends them back there after verifying. */}
              <input type="hidden" name="callbackUrl" value={callbackPath} />
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  placeholder="tu@empresa.com.ar"
                  defaultValue={email ?? ""}
                  aria-invalid={error === "not_allowed" || undefined}
                  aria-describedby={error ? "login-error" : undefined}
                />
              </div>
              {error === "missing" && (
                <p id="login-error" className="text-sm text-destructive">
                  Ingresá un email válido.
                </p>
              )}
              {error === "not_allowed" && (
                <p id="login-error" role="alert" className="text-sm text-destructive">
                  Ese email no tiene acceso a este panel. Revisá que esté bien escrito.
                </p>
              )}
              {error === "unknown" && (
                <p id="login-error" role="alert" className="text-sm text-destructive">
                  Ocurrió un error. Probá de nuevo en unos minutos.
                </p>
              )}
              <Button type="submit" className="w-full">
                Enviar link de acceso
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

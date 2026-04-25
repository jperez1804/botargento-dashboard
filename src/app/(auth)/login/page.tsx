import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { env } from "@/lib/env";
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
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) {
    redirect("/login?error=missing");
  }
  // signIn triggers Auth.js's resend flow:
  //   - allowlist check in sendVerificationRequest
  //   - hashed token stored in dashboard.magic_link_tokens
  //   - email dispatched via Resend (dev: URL logged to terminal)
  // On success Auth.js redirects us to pages.verifyRequest (= /login?sent=1)
  await signIn("resend", { email, redirectTo: "/" });
}

type PageProps = {
  searchParams: Promise<{ sent?: string; error?: string; callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const { sent, error } = await searchParams;
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
                <a href="/login" className="text-primary underline-offset-4 hover:underline">
                  Enviar otro link
                </a>
              </p>
            </div>
          ) : (
            <form action={requestLink} className="space-y-4">
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
                />
              </div>
              {error === "missing" && (
                <p className="text-sm text-destructive">Ingresá un email válido.</p>
              )}
              {error === "unknown" && (
                <p className="text-sm text-destructive">
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

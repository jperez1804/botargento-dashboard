import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import { env } from "@/lib/env";
import { tenantConfig } from "@/config/tenant";
import { getAppSettings } from "@/lib/queries/app-settings";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Display serif used for page mastheads, section headers, and hero KPI values.
// Variable axes give us SOFT (curve roundness) and opsz (optical-size) so the
// big mastheads can use the high-contrast display cut while smaller section
// headers stay readable.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const runtimeEnv = env();

  return {
    title: `${runtimeEnv.CLIENT_NAME} · Panel de reportes`,
    description: `Panel de reportes de WhatsApp para ${runtimeEnv.CLIENT_NAME}`,
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const tenant = tenantConfig();

  // Settings live in dashboard.app_settings (single row per tenant). The env
  // value tenant.primaryColor is now only the boot fallback — once Phase B's
  // /settings page lands, admins can change this from the UI without redeploy.
  const settings = await getAppSettings();

  const brandStyle: CSSProperties = {
    ["--client-primary" as string]: settings.primaryColor,
  };

  return (
    <html
      lang={tenant.locale.split("-")[0] ?? "es"}
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--canvas)] text-[var(--ink)]" style={brandStyle}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}

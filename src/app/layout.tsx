import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import { env } from "@/lib/env";
import { tenantConfig } from "@/config/tenant";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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

  // Inject the tenant accent color as a CSS var accessible to every component.
  // Using a dedicated --client-primary keeps the neutral base theme intact
  // while still letting each tenant recolor accents at runtime.
  const brandStyle: CSSProperties = {
    ["--client-primary" as string]: tenant.primaryColor,
  };

  return (
    <html
      lang={tenant.locale.split("-")[0] ?? "es"}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#fafafa] text-[#111827]" style={brandStyle}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}

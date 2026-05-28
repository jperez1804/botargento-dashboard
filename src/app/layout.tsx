import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import { env } from "@/lib/env";
import { tenantConfig } from "@/config/tenant";
import { getAppSettings } from "@/lib/queries/app-settings";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Inline script that runs BEFORE first paint and sets the .dark class on
// <html> based on the persisted preference (or system preference if none).
// Prevents a flash of light content on initial load when the user has
// previously chosen dark mode. The actual toggle lives in
// src/components/dashboard/ThemeToggle.tsx.
const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}`;

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
  const settings = await getAppSettings();

  const brandStyle: CSSProperties = {
    ["--client-primary" as string]: settings.primaryColor,
  };

  return (
    <html
      lang={tenant.locale.split("-")[0] ?? "es"}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--canvas)] text-[var(--ink)]" style={brandStyle}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}

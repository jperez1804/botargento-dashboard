import { z } from "zod";

const schema = z.object({
  // Database
  TENANT_DB_URL: z.string().min(1, "TENANT_DB_URL is required"),

  // Auth.js
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 chars (use `openssl rand -hex 32`)"),
  AUTH_URL: z.string().url("AUTH_URL must be a full URL (e.g. https://dashboard.client1.botargento.com.ar)"),
  AUTH_EMAIL_FROM: z.string().email("AUTH_EMAIL_FROM must be a valid email address"),
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),

  // Tenant branding
  CLIENT_NAME: z.string().min(1, "CLIENT_NAME is required"),
  CLIENT_LOGO_URL: z.string().min(1).default("/logos/default.svg"),
  CLIENT_PRIMARY_COLOR: z
    .string()
    .regex(/^#[0-9a-fA-F]{3,8}$/, "CLIENT_PRIMARY_COLOR must be a hex color like #4a7ec4")
    .default("#3b82f6"),
  CLIENT_TIMEZONE: z.string().min(1).default("America/Argentina/Buenos_Aires"),
  CLIENT_LOCALE: z.string().min(1).default("es-AR"),

  // Vertical selection (used by Step 7)
  VERTICAL: z.string().min(1).default("real-estate"),

  // Runtime
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

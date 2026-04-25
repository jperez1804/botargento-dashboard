import type { Config } from "drizzle-kit";

const url = process.env.TENANT_DB_URL;
if (!url) {
  throw new Error("TENANT_DB_URL is required for drizzle-kit");
}

export default {
  schema: "./src/db/schema.ts",
  out: "./migrations/generated",
  dialect: "postgresql",
  dbCredentials: { url },
  schemaFilter: ["dashboard"],
  verbose: true,
  strict: true,
} satisfies Config;

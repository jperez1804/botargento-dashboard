import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "@/db/schema";

declare global {
  // eslint-disable-next-line no-var
  var __pg_client: ReturnType<typeof postgres> | undefined;
}

const client =
  global.__pg_client ??
  postgres(env().TENANT_DB_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (env().NODE_ENV !== "production") {
  global.__pg_client = client;
}

export const db = drizzle(client, { schema });
export const sql = client;

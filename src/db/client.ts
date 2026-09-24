import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "@/db/schema";

type SqlClient = ReturnType<typeof postgres>;

function createDb(sqlClient: SqlClient) {
  return drizzle(sqlClient, { schema });
}

type DbClient = ReturnType<typeof createDb>;

declare global {
  var __pg_client: SqlClient | undefined;
  var __db_client: DbClient | undefined;
}

// ONE pool per process. `sql` is a Proxy, so every query goes through
// getSqlClient(); caching only on `global` (which dev needs to survive HMR)
// left production building a fresh pool — and a fresh connection — per query.
// A page that runs a dozen of them then exhausted the server's connection
// slots ("remaining connection slots are reserved for roles with the SUPERUSER
// attribute"). These module-level singletons are what prevent that.
let pgClient: SqlClient | undefined;
let dbSingleton: DbClient | undefined;

function getSqlClient(): SqlClient {
  if (global.__pg_client) return global.__pg_client;
  if (pgClient) return pgClient;

  pgClient = postgres(env().TENANT_DB_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  if (env().NODE_ENV !== "production") {
    global.__pg_client = pgClient;
  }

  return pgClient;
}

function getDbClient(): DbClient {
  if (global.__db_client) return global.__db_client;
  if (dbSingleton) return dbSingleton;

  dbSingleton = createDb(getSqlClient());
  if (env().NODE_ENV !== "production") {
    global.__db_client = dbSingleton;
  }

  return dbSingleton;
}

// Lazily initialize the tenant DB binding so Docker builds can import this
// module before runtime secrets exist inside the container image.
export const db = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getDbClient(), prop, receiver);
  },
}) as DbClient;

export const sql = new Proxy(
  ((...args: Parameters<SqlClient>) => getSqlClient()(...args)) as SqlClient,
  {
    apply(_target, thisArg, argArray) {
      return Reflect.apply(getSqlClient() as never, thisArg, argArray);
    },
    get(_target, prop, receiver) {
      return Reflect.get(getSqlClient(), prop, receiver);
    },
  },
) as SqlClient;

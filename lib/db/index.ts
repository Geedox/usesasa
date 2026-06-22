import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Don't crash at import time (e.g. during build); fail loudly only when queried.
  console.warn("[db] DATABASE_URL is not set — database calls will fail.");
}

// Cache only the postgres CLIENT (the connection pool) on globalThis. Without this,
// Next's dev HMR re-evaluates this module on every reload and opens a brand-new pool
// each time, leaking connections until Postgres hits max_connections. We do NOT cache
// the drizzle instance — it must be rebuilt each eval so newly added schema tables
// always register in db.query (a cached instance would carry a stale schema).
declare global {
  // eslint-disable-next-line no-var
  var __sasaDbClient: ReturnType<typeof postgres> | undefined;
}

// `prepare: false` is recommended when running behind connection poolers. A modest
// pool with idle/lifetime timeouts keeps us well under Postgres' connection cap even
// with the app + worker running side by side.
const client =
  globalThis.__sasaDbClient ??
  postgres(connectionString ?? "postgres://sasa:sasa@127.0.0.1:55432/sasa", {
    prepare: false,
    max: 10,
    idle_timeout: 20, // close idle connections after 20s
    max_lifetime: 60 * 30, // recycle a connection after 30m
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__sasaDbClient = client;
}

// Rebuilt every module eval (cheap; no new connections) so the schema is always current.
export const db = drizzle(client, { schema });
export { schema };

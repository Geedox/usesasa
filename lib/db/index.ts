import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Don't crash at import time (e.g. during build); fail loudly only when queried.
  console.warn("[db] DATABASE_URL is not set — database calls will fail.");
}

// `prepare: false` is recommended when running behind connection poolers.
const client = postgres(connectionString ?? "postgres://sasa:sasa@127.0.0.1:55432/sasa", {
  prepare: false,
});

export const db = drizzle(client, { schema });
export { schema };

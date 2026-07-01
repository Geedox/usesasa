// Programmatic migrator — runs pending Drizzle migrations against DATABASE_URL.
// Used locally (`pnpm db:migrate`) and on deploy. More reliable than the
// drizzle-kit CLI runner and surfaces real errors.
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (.env.local).");
  process.exit(1);
}

async function main() {
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "lib/db/migrations" });
  await sql.end();
  console.log("✓ migrations applied");
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});

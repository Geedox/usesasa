// Copy the `mentors` table from one database to another (e.g. dev -> prod), without
// re-entering anything. Idempotent (ON CONFLICT DO NOTHING) so it's safe to re-run.
//
// Usage:
//   DEV_DATABASE_URL='postgres://…dev…' \
//   PROD_DATABASE_URL='postgres://…prod…' \
//   node scripts/migrate-mentors.mjs
//
// Add NO_SSL=1 if a connection doesn't use TLS. Add DRY_RUN=1 to preview only.
import postgres from "postgres";

const FROM = process.env.DEV_DATABASE_URL;
const TO = process.env.PROD_DATABASE_URL;
if (!FROM || !TO) {
  console.error("Set DEV_DATABASE_URL (source) and PROD_DATABASE_URL (destination).");
  process.exit(1);
}
const ssl = process.env.NO_SSL === "1" ? false : "require";
const dryRun = process.env.DRY_RUN === "1";

const from = postgres(FROM, { ssl, max: 1, onnotice: () => {} });
const to = postgres(TO, { ssl, max: 1, onnotice: () => {} });

try {
  const mentors = await from`SELECT * FROM mentors ORDER BY sort_order, created_at`;
  console.log(`Source has ${mentors.length} mentor(s).${dryRun ? " (dry run — nothing will be written)" : ""}\n`);

  let copied = 0, skipped = 0, nulledUser = 0;
  for (const m of mentors) {
    // Keep the linked user only if that user exists in the destination; otherwise null
    // it (the column is optional and only marks an approved applicant).
    let userId = m.user_id;
    if (userId) {
      const [u] = await to`SELECT id FROM users WHERE id = ${userId} LIMIT 1`;
      if (!u) { userId = null; nulledUser++; }
    }

    if (dryRun) { console.log(`would copy: ${m.name}${userId ? "" : " (no linked user)"}`); continue; }

    const res = await to`
      INSERT INTO mentors (id, user_id, name, title, bio, expertise, photo_url, cal_link, active, sort_order, created_at)
      VALUES (${m.id}, ${userId}, ${m.name}, ${m.title ?? null}, ${m.bio ?? null}, ${m.expertise ?? null},
              ${m.photo_url ?? null}, ${m.cal_link ?? null}, ${m.active}, ${m.sort_order}, ${m.created_at})
      ON CONFLICT (id) DO NOTHING
      RETURNING id`;
    if (res.length) { copied++; console.log(`+ copied: ${m.name}`); }
    else { skipped++; console.log(`= skipped (already in destination): ${m.name}`); }
  }

  console.log(`\nDone. Copied ${copied}, skipped ${skipped}${nulledUser ? `, ${nulledUser} had their linked user cleared` : ""}.`);
} catch (e) {
  console.error("\nMigration failed:", e.message || e);
  process.exitCode = 1;
} finally {
  await from.end({ timeout: 5 });
  await to.end({ timeout: 5 });
}

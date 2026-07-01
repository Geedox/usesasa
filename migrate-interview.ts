import { config } from "dotenv"; config({ path: ".env.local" });
// One-off: create/upgrade the interview-prep tables (db:push needs a TTY, so we run
// the statements directly). Idempotent — safe to re-run.
(async () => {
  const { db } = await import("./lib/db");
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mentors (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      name text NOT NULL,
      title text,
      bio text,
      expertise text[],
      photo_url text,
      cal_link text,
      active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  // Upgrades for an already-created mentors table.
  await db.execute(sql`ALTER TABLE mentors ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL`);
  await db.execute(sql`ALTER TABLE mentors ALTER COLUMN cal_link DROP NOT NULL`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS interview_bookings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mentor_id uuid REFERENCES mentors(id) ON DELETE SET NULL,
      application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
      job_title text,
      company_name text,
      external_job_url text,
      job_description text,
      skills text,
      cal_booking_uid text,
      meeting_url text,
      scheduled_at timestamptz,
      status text NOT NULL DEFAULT 'pending',
      credits_charged integer NOT NULL DEFAULT 0,
      reminders_sent jsonb,
      feedback_score integer,
      feedback_text text,
      feedback_at timestamptz,
      note text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`ALTER TABLE interview_bookings ADD COLUMN IF NOT EXISTS feedback_score integer`);
  await db.execute(sql`ALTER TABLE interview_bookings ADD COLUMN IF NOT EXISTS feedback_text text`);
  await db.execute(sql`ALTER TABLE interview_bookings ADD COLUMN IF NOT EXISTS feedback_at timestamptz`);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS interview_bookings_cal_uid_unique
    ON interview_bookings (cal_booking_uid)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mentor_applications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      resume_url text,
      linkedin_url text,
      other_links text[],
      pitch text,
      status text NOT NULL DEFAULT 'pending',
      rejection_reason text,
      reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  console.log("interview-prep tables ready.");
  process.exit(0);
})();

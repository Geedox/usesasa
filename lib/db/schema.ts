// Sasa database schema (Drizzle / Postgres).
// Source of truth: FRD §7.3, with the voice-profile extension from PLAN.md §3a.
// The `users` table is owned by us (no Supabase auth.users); the Better Auth slice
// will adopt/extend it (sessions, accounts, verification) — see DECISIONS.md.

import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  time,
  unique,
} from "drizzle-orm/pg-core";

// ---- shared string-union types (kept as text columns for easy evolution) ----
export type Ats =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "smartrecruiters"
  | "workday"
  | "workable"
  | "wellfound"
  | "yc"
  | "remoteok"
  | "weworkremotely";
export type SponsorshipSignal = "sponsors" | "does_not_sponsor" | "unknown";
export type MatchAction = "pending" | "queued" | "skipped" | "snoozed";
export type ApplicationState =
  | "drafted"
  | "awaiting_review"
  | "queued"
  | "sending"
  | "submitted"
  | "needs_user"
  | "failed"
  | "dismissed"; // user skipped this draft (e.g. from the Telegram nudge)
export type PipelineStatus = "applied" | "viewed" | "replied" | "interview" | "rejected" | "offer";
export type EmailClass = PipelineStatus | "unrelated";
export type LedgerReason =
  | "signup_bonus"
  | "beta_bonus"
  | "paystack_purchase"
  | "application_charge"
  | "refund"
  | "manual_adjustment";
export type WaDirection = "inbound" | "outbound";

// ---- users (owned by us; adopted/extended by Better Auth) ----
// Better Auth requires: name, email, emailVerified, image, createdAt, updatedAt.
// App-specific fields (fullName, phone, whatsappOptedIn) live alongside them.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // app-specific
  fullName: text("full_name"),
  phone: text("phone"),
  whatsappOptedIn: boolean("whatsapp_opted_in").notNull().default(false),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  extensionTokenHash: text("extension_token_hash"), // sha256 of the Chrome-extension pairing token
  extensionTokenExpiresAt: timestamp("extension_token_expires_at", { withTimezone: true }), // token valid until
  telegramChatId: text("telegram_chat_id"), // set once the user links their Telegram
  telegramLinkToken: text("telegram_link_token"), // short-lived deep-link token for pairing

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Better Auth: sessions ----
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Better Auth: accounts (OAuth providers + email/password credential) ----
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Better Auth: verifications (email verify + password-reset magic links) ----
export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- versioned profile (parsed CV + voice profile) ----
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  isCurrent: boolean("is_current").notNull().default(true),
  parsedData: jsonb("parsed_data"), // the Profile type from FRD §5.1.3; null until parsed
  cvStoragePath: text("cv_storage_path"), // Cloudinary public_id / secure ref
  writingSample: text("writing_sample"),
  // PLAN §3a voice & expectations (one-time capture + learn-from-edits notes)
  voiceProfile: jsonb("voice_profile"), // { tone, length, doNotSay[], mustMention[], answers, notes }
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- user preferences ----
export const preferences = pgTable("preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  targetRoles: text("target_roles").array(),
  seniority: text("seniority"),
  targetLocations: text("target_locations").array(),
  salaryMinUsd: integer("salary_min_usd"),
  needsSponsorship: boolean("needs_sponsorship"),
  sponsorshipCountries: text("sponsorship_countries").array(),
  excludedCompanies: text("excluded_companies").array(),
  dailyAlertCap: integer("daily_alert_cap").notNull().default(10),
  autoSendDelayMinutes: integer("auto_send_delay_minutes").notNull().default(120),
  digestTime: time("digest_time"),
  digestTimezone: text("digest_timezone").default("Africa/Lagos"),
  // Onboarding wizard answers (location, contact, eligibility, checklist, app settings)
  onboarding: jsonb("onboarding"),
  // App password for ATS sites that require account creation — stored AES-256-GCM encrypted.
  applicationPasswordEnc: text("application_password_enc"),
});

// ---- watched companies + sponsorship signal ----
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ats: text("ats").$type<Ats>().notNull(),
  atsSlug: text("ats_slug").notNull(),
  homepage: text("homepage"),
  sponsorshipUk: text("sponsorship_uk").$type<SponsorshipSignal>().default("unknown"),
  sponsorshipCa: text("sponsorship_ca").$type<SponsorshipSignal>().default("unknown"),
  sponsorshipEu: text("sponsorship_eu").$type<SponsorshipSignal>().default("unknown"),
  sponsorshipUs: text("sponsorship_us").$type<SponsorshipSignal>().default("unknown"),
  lastCrawledAt: timestamp("last_crawled_at", { withTimezone: true }),
}, (t) => [unique("companies_ats_slug_unique").on(t.ats, t.atsSlug)]);

// ---- discovered jobs ----
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  source: text("source").$type<Ats>().notNull(),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  url: text("url"), // apply/posting URL (for the extension to open)
  location: text("location"),
  remotePolicy: text("remote_policy"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  salaryCurrency: text("salary_currency"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  rawJd: text("raw_jd"),
  parsedJd: jsonb("parsed_jd"),
  isActive: boolean("is_active").notNull().default(true),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("jobs_source_external_id_unique").on(t.source, t.externalId)]);

// ---- job-user matches ----
export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  profileVersion: integer("profile_version"),
  score: integer("score").notNull(),
  reasons: jsonb("reasons"),
  userAction: text("user_action").$type<MatchAction>().notNull().default("pending"),
  surfacedAt: timestamp("surfaced_at", { withTimezone: true }).notNull().defaultNow(),
  nudgedAt: timestamp("nudged_at", { withTimezone: true }), // set when we asked on Telegram "Apply?"
}, (t) => [unique("matches_user_job_unique").on(t.userId, t.jobId)]);

// ---- applications ----
export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  matchId: uuid("match_id").references(() => matches.id, { onDelete: "set null" }),
  state: text("state").$type<ApplicationState>().notNull().default("drafted"),
  tailoredCvPath: text("tailored_cv_path"),
  tailoredCv: jsonb("tailored_cv"), // { experience: [{ company, title, originalBullets[], rewrittenBullets[] }] }
  tailoringValidation: jsonb("tailoring_validation"), // { fabrications: string[], clean: boolean }
  coverLetterText: text("cover_letter_text"),
  customAnswers: jsonb("custom_answers"),
  submissionNote: text("submission_note"), // why a submit ended needs_user/failed (e.g. unmapped field)
  creditsCharged: integer("credits_charged").notNull().default(0),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  pipelineStatus: text("pipeline_status").$type<PipelineStatus>(),
  pipelineUpdatedAt: timestamp("pipeline_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("applications_user_job_unique").on(t.userId, t.jobId)]);

// ---- recruiter emails routed to applications ----
export const recruiterMessages = pgTable("recruiter_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  gmailMessageId: text("gmail_message_id").notNull(),
  sender: text("sender"),
  subject: text("subject"),
  body: text("body"),
  classification: text("classification").$type<EmailClass>(),
  receivedAt: timestamp("received_at", { withTimezone: true }),
}, (t) => [unique("recruiter_messages_gmail_id_unique").on(t.gmailMessageId)]);

// ---- credits ledger ----
export const creditLedger = pgTable("credit_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(), // + added, - spent
  reason: text("reason").$type<LedgerReason>().notNull(),
  relatedId: uuid("related_id"), // application_id or paystack_tx_id
  balanceAfter: integer("balance_after").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Paystack transactions ----
export const paystackTransactions = pgTable("paystack_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  paystackReference: text("paystack_reference").notNull().unique(),
  amountKobo: integer("amount_kobo").notNull(),
  status: text("status").notNull(),
  creditsPurchased: integer("credits_purchased"),
  rawWebhook: jsonb("raw_webhook"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- WhatsApp message log ----
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  direction: text("direction").$type<WaDirection>().notNull(),
  template: text("template"),
  body: text("body"),
  status: text("status"),
  raw: jsonb("raw"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

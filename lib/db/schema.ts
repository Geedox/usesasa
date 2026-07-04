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
  index,
} from "drizzle-orm/pg-core";

// ---- shared string-union types (kept as text columns for easy evolution) ----
export type Ats =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "smartrecruiters"
  | "workday"
  | "workable"
  | "recruitee"
  | "teamtailor"
  | "bamboohr"
  | "breezy"
  | "personio"
  | "gem"
  | "zoho"
  | "pinpoint"
  | "custom"
  | "wellfound"
  | "yc"
  | "remoteok"
  | "weworkremotely"
  | "myjobmag"
  | "jobberman"
  | "thehub"
  | "himalayas"
  | "remotive"
  | "arbeitnow"
  | "themuse"
  | "brightermonday"
  | "fuzu"
  | "ngcareers";
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
  | "tailoring_charge" // 1 credit when we tailor a CV + cover letter for a role
  | "application_charge" // 1 credit when an application is submitted
  | "onboarding_charge" // 2 credits for the CV parse done during onboarding
  | "discovery_charge" // 1 credit for a manual "Find more" scan + rescore
  | "interview_booking" // 24 credits spent booking an interview-prep call
  | "interview_refund" // those 3 credits returned when the call is cancelled
  | "referral_bonus" // credits earned from referring another user
  | "refund"
  | "manual_adjustment";
export type WaDirection = "inbound" | "outbound";
// Interview-prep booking lifecycle: created (awaiting Cal confirmation) ->
// confirmed (Cal booked, credits charged) -> completed, or cancelled (refunded).
export type InterviewStatus = "pending" | "confirmed" | "completed" | "cancelled";
// Mentor application review state. Rejected carries a reason the applicant sees,
// and they can re-apply (a fresh row).
export type MentorAppStatus = "pending" | "approved" | "rejected";
export type SubscriptionStatus = "active" | "cancelled" | "past_due";

// ---- users (owned by us; adopted/extended by Better Auth) ----
// Better Auth requires: name, email, emailVerified, image, createdAt, updatedAt.
// App-specific fields (fullName, phone, whatsappOptedIn) live alongside them.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Canonical email (plus/dot aliases collapsed) — anti-abuse dedup for the signup bonus.
  normalizedEmail: text("normalized_email"),
  // app-specific
  fullName: text("full_name"),
  phone: text("phone"),
  whatsappOptedIn: boolean("whatsapp_opted_in").notNull().default(false),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  extensionTokenHash: text("extension_token_hash"), // sha256 of the Chrome-extension pairing token
  extensionTokenExpiresAt: timestamp("extension_token_expires_at", { withTimezone: true }), // token valid until
  telegramChatId: text("telegram_chat_id"), // set once the user links their Telegram
  telegramLinkToken: text("telegram_link_token"), // short-lived deep-link token for pairing
  referralCode: text("referral_code").unique(), // the user's own 6-char code, generated once at signup
  // Admin moderation: set when an admin suspends the account. A suspended user is
  // blocked from every paid Sasa action (dashboard, extension, Telegram, submissions).
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  suspendedReason: text("suspended_reason"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("users_normalized_email_idx").on(t.normalizedEmail)]);

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
  // Preferred work arrangements (subset of remote/hybrid/onsite); empty/null = any.
  workArrangements: text("work_arrangements").array(),
  // Student/experience mode: only surface internships when true.
  internshipOnly: boolean("internship_only").notNull().default(false),
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
  logoUrl: text("logo_url"), // company logo; falls back to an initials avatar when null
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
  // Normalized "company|title" key for cross-source dedup (same role on RemoteOK +
  // Remotive + a company board). Set on insert; aggregators skip a key already seen.
  dedupeKey: text("dedupe_key"),
  isActive: boolean("is_active").notNull().default(true),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("jobs_source_external_id_unique").on(t.source, t.externalId),
  index("jobs_dedupe_key_idx").on(t.dedupeKey),
]);

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
  submittedVia: text("submitted_via"), // "cloud" | "extension" — for the monthly cloud cap
  submissionViewUrl: text("submission_view_url"), // Steel live-view URL: watch + take over the cloud browser
  submissionSessionId: text("submission_session_id"), // Steel session id (for keep-alive / takeover)
  awaitingCode: boolean("awaiting_code").notNull().default(false), // paused waiting for an emailed verification code
  submissionLog: jsonb("submission_log"), // [{ label, at, status }] — live progress steps streamed to the UI
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

// ---- Anthropic token usage (per call), for the admin spend dashboard ----
export const anthropicUsage = pgTable("anthropic_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  tag: text("tag").notNull(), // feature that made the call, e.g. "tailor.generate"
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("anthropic_usage_created_idx").on(t.createdAt), index("anthropic_usage_tag_idx").on(t.tag)]);

// ---- user feedback (surfaced in the admin) ----
export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category"), // "idea" | "bug" | "praise" | "other"
  message: text("message").notNull(),
  page: text("page"), // where they were when they sent it
  handledAt: timestamp("handled_at", { withTimezone: true }), // set when an admin marks it reviewed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("feedback_created_idx").on(t.createdAt)]);

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

// ---- interview-prep mentors (curated roster) ----
// Our senior professionals the user can book a prep call with. Each carries their
// own self-hosted Cal.com event link, which the page embeds for booking.
export const mentors = pgTable("mentors", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }), // the approved applicant, if any
  name: text("name").notNull(),
  title: text("title"), // e.g. "Staff Engineer, ex-Stripe"
  bio: text("bio"),
  expertise: text("expertise").array(), // e.g. ["Backend", "System design", "Behavioral"]
  photoUrl: text("photo_url"),
  calLink: text("cal_link"), // optional Cal.com event link the admin sets for this mentor
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- mentor applications (logged-in users applying to take interviews) ----
export const mentorApplications = pgTable("mentor_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  photoUrl: text("photo_url"), // applicant's profile picture
  resumeUrl: text("resume_url"),
  linkedinUrl: text("linkedin_url"),
  otherLinks: text("other_links").array(),
  pitch: text("pitch"), // why they would be a good mentor / background
  status: text("status").$type<MentorAppStatus>().notNull().default("pending"),
  rejectionReason: text("rejection_reason"), // shown to the applicant so they can re-apply
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- interview-prep bookings ----
// A pending row is created when the user submits the form (job context captured),
// then confirmed by the Cal.com webhook once they pick a slot — that is when the 3
// credits are charged and reminders are scheduled.
export const interviewBookings = pgTable("interview_bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mentorId: uuid("mentor_id").references(() => mentors.id, { onDelete: "set null" }),
  // Job context. Either an in-system application, or a free-text external job.
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
  jobTitle: text("job_title"),
  companyName: text("company_name"),
  externalJobUrl: text("external_job_url"), // set when it is not a job already in Sasa
  jobDescription: text("job_description"),
  skills: text("skills"), // skills/requirements the user wants to prep for
  // Cal.com linkage (filled by the webhook).
  calBookingUid: text("cal_booking_uid"),
  meetingUrl: text("meeting_url"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  status: text("status").$type<InterviewStatus>().notNull().default("pending"),
  creditsCharged: integer("credits_charged").notNull().default(0),
  remindersSent: jsonb("reminders_sent"), // string[] of kinds already sent: ["24h","1h","10min"]
  // Mentor feedback after the call (visible to the interviewee).
  feedbackScore: integer("feedback_score"), // 0-100, honest score
  feedbackText: text("feedback_text"),
  feedbackAt: timestamp("feedback_at", { withTimezone: true }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("interview_bookings_cal_uid_unique").on(t.calBookingUid)]);

// ---- email integrations (read-only Gmail for OTP / verification-link capture) ----
// Separate from Better Auth's `accounts` (which holds the login Google tokens with
// only basic scopes). This holds the extra gmail.readonly grant + offline refresh
// token, so we can read job-related emails without touching the login session.
export const emailIntegrations = pgTable("email_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("gmail"),
  email: text("email"), // the connected mailbox address
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  scope: text("scope"),
  status: text("status").notNull().default("connected"), // connected | revoked
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("email_integrations_user_provider_unique").on(t.userId, t.provider)]);

// ---- referrals ----
// One row per referred user. Rewards go to the referrer only, once per milestone:
// +5 when the referred user finishes onboarding, +5 when they buy the ₦15k pack,
// +5 when they buy the ₦30k pack. Flags enforce once-only (no reward on recharges).
export const referrals = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrerId: uuid("referrer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  referredId: uuid("referred_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull(), // the referrer's code used at signup
  rewardedSignup: boolean("rewarded_signup").notNull().default(false),
  rewarded15k: boolean("rewarded_15k").notNull().default(false),
  rewarded30k: boolean("rewarded_30k").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("referrals_referred_unique").on(t.referredId)]);

// ---- subscriptions (international plans; Nigeria uses credits instead) ----
// A user with an active subscription is metered by a monthly application allowance
// (no per-use credit charge). Nigerians never subscribe — they stay on credits.
export const subscriptions = pgTable("subscriptions", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull(), // e.g. "starter" | "pro" | "power"
  status: text("status").$type<SubscriptionStatus>().notNull().default("active"),
  paystackCustomerCode: text("paystack_customer_code"),
  paystackSubscriptionCode: text("paystack_subscription_code"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

ALTER TABLE "preferences" ADD COLUMN "onboarding" jsonb;--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN "application_password_enc" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamp with time zone;
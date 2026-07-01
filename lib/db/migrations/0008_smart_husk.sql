ALTER TABLE "users" ADD COLUMN "normalized_email" text;--> statement-breakpoint
CREATE INDEX "users_normalized_email_idx" ON "users" USING btree ("normalized_email");
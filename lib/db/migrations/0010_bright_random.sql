CREATE TABLE "anthropic_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "anthropic_usage_created_idx" ON "anthropic_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "anthropic_usage_tag_idx" ON "anthropic_usage" USING btree ("tag");
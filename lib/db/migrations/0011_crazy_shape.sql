ALTER TABLE "preferences" ADD COLUMN "work_arrangements" text[];--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN "internship_only" boolean DEFAULT false NOT NULL;
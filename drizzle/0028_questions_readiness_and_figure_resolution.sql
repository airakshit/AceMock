ALTER TABLE "questions" ADD COLUMN "figure_resolved" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "is_ready" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "not_ready_reason" text;

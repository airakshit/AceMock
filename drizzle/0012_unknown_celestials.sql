ALTER TABLE "mock-tests" ADD COLUMN "negative_percent_per_question" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mock-tests" DROP COLUMN "visibility";
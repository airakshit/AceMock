ALTER TABLE "questions" ALTER COLUMN "question" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "options" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "correct_option" DROP NOT NULL;
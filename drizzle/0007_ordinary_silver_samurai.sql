ALTER TABLE "questions" DROP CONSTRAINT "questions_chapter_id_chapters_id_fk";
--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "chapter_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;
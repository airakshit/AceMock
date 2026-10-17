ALTER TABLE "question_reports" DROP CONSTRAINT "question_reports_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "question_reports" DROP CONSTRAINT "question_reports_question_id_questions_id_fk";
--> statement-breakpoint
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;
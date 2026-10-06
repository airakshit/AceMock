CREATE INDEX "question_reports_created_at_id_idx" ON "question_reports" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "question_reports_report_type_created_at_id_idx" ON "question_reports" USING btree ("report_type","created_at","id");--> statement-breakpoint
CREATE INDEX "question_reports_user_question_type_idx" ON "question_reports" USING btree ("user_id","question_id","report_type");--> statement-breakpoint
CREATE INDEX "question_reports_question_id_idx" ON "question_reports" USING btree ("question_id");
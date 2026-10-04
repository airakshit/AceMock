CREATE INDEX "mock_tests_created_at_id_idx" ON "mock_tests" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "mock_tests_scope_created_at_id_idx" ON "mock_tests" USING btree ("scope","created_at","id");--> statement-breakpoint
CREATE INDEX "mock_tests_by_admin_created_at_id_idx" ON "mock_tests" USING btree ("by_admin","created_at","id");--> statement-breakpoint
CREATE INDEX "mock_tests_subject_id_created_at_id_idx" ON "mock_tests" USING btree ("subject_id","created_at","id");--> statement-breakpoint
CREATE INDEX "mock_tests_section_id_created_at_id_idx" ON "mock_tests" USING btree ("section_id","created_at","id");--> statement-breakpoint
CREATE INDEX "mock_tests_chapter_id_created_at_id_idx" ON "mock_tests" USING btree ("chapter_id","created_at","id");
ALTER TABLE "mock-tests" RENAME TO "mock_tests";--> statement-breakpoint
ALTER TABLE "mock-tests-questions" RENAME TO "mock_tests_questions";--> statement-breakpoint
ALTER TABLE "mock_tests" DROP CONSTRAINT "mock-tests_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "mock_tests_questions" DROP CONSTRAINT "mock-tests-questions_mock_test_id_mock-tests_id_fk";
--> statement-breakpoint
ALTER TABLE "mock_tests_questions" DROP CONSTRAINT "mock-tests-questions_question_id_questions_id_fk";
--> statement-breakpoint
ALTER TABLE "mock_tests" ADD CONSTRAINT "mock_tests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_tests_questions" ADD CONSTRAINT "mock_tests_questions_mock_test_id_mock_tests_id_fk" FOREIGN KEY ("mock_test_id") REFERENCES "public"."mock_tests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_tests_questions" ADD CONSTRAINT "mock_tests_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;
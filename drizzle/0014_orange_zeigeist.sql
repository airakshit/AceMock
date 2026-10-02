CREATE TYPE "public"."question_report_type_enum" AS ENUM('invalid_question', 'invalid_options', 'invalid_solution', 'incomplete_solution', 'rendering_error', 'other');--> statement-breakpoint
CREATE TYPE "public"."mock_attempt_status_enum" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "question_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"report_type" "question_report_type_enum" NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mock_tests_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"mock_test_id" uuid NOT NULL,
	"status" "mock_attempt_status_enum" DEFAULT 'in_progress' NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mock_attempt_answers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option" char NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "option_valid" CHECK ("mock_attempt_answers"."selected_option" IN ('A', 'B', 'C', 'D'))
);
--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "correct_option" SET DATA TYPE char(1);--> statement-breakpoint
ALTER TABLE "mock_tests" ADD COLUMN "max_attempts" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_tests_attempts" ADD CONSTRAINT "mock_tests_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_tests_attempts" ADD CONSTRAINT "mock_tests_attempts_mock_test_id_mock_tests_id_fk" FOREIGN KEY ("mock_test_id") REFERENCES "public"."mock_tests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_attempt_answers" ADD CONSTRAINT "mock_attempt_answers_attempt_id_mock_tests_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."mock_tests_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_attempt_answers" ADD CONSTRAINT "mock_attempt_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "option_valid" CHECK ("questions"."correct_option" IN ('A', 'B', 'C', 'D'));--> statement-breakpoint
DROP TYPE "public"."visibility_enum";
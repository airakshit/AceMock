CREATE TYPE "public"."mock_test_scope" AS ENUM('ioe_model', 'subject', 'section', 'chapter', 'miscellaneous');--> statement-breakpoint
ALTER TABLE "mock_tests" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "mock_tests" ADD COLUMN "document_id" uuid;--> statement-breakpoint
ALTER TABLE "mock_tests" ADD COLUMN "by_admin" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "mock_tests" ADD COLUMN "scope" "mock_test_scope" NOT NULL;--> statement-breakpoint
ALTER TABLE "mock_tests" ADD COLUMN "subject_id" uuid;--> statement-breakpoint
ALTER TABLE "mock_tests" ADD COLUMN "section_id" uuid;--> statement-breakpoint
ALTER TABLE "mock_tests" ADD COLUMN "chapter_id" uuid;--> statement-breakpoint
ALTER TABLE "mock_tests" ADD COLUMN "allow_untimed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "mock_tests" ADD CONSTRAINT "mock_tests_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_tests" ADD CONSTRAINT "mock_tests_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_tests" ADD CONSTRAINT "mock_tests_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_tests" ADD CONSTRAINT "mock_tests_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_tests" ADD CONSTRAINT "mock_test_scope_reference_check" CHECK (
        (
          "mock_tests"."scope" = 'ioe_model'
          AND "mock_tests"."subject_id" IS NULL
          AND "mock_tests"."section_id" IS NULL
          AND "mock_tests"."chapter_id" IS NULL
        )
        OR
        (
          "mock_tests"."scope" = 'miscellaneous'
          AND "mock_tests"."subject_id" IS NULL
          AND "mock_tests"."section_id" IS NULL
          AND "mock_tests"."chapter_id" IS NULL
        )
        OR
        (
          "mock_tests"."scope" = 'subject'
          AND "mock_tests"."subject_id" IS NOT NULL
          AND "mock_tests"."section_id" IS NULL
          AND "mock_tests"."chapter_id" IS NULL
        )
        OR
        (
          "mock_tests"."scope" = 'section'
          AND "mock_tests"."subject_id" IS NOT NULL
          AND "mock_tests"."section_id" IS NOT NULL
          AND "mock_tests"."chapter_id" IS NULL
        )
        OR
        (
          "mock_tests"."scope" = 'chapter'
          AND "mock_tests"."subject_id" IS NOT NULL
          AND "mock_tests"."section_id" IS NOT NULL
          AND "mock_tests"."chapter_id" IS NOT NULL
        )
      );
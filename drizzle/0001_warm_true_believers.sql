CREATE TYPE "public"."document_processing_status_enum" AS ENUM('not_started', 'processing', 'extracting_questions', 'success', 'failed');--> statement-breakpoint
ALTER TABLE "file_pages" ALTER COLUMN "ocr_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "file_pages" ALTER COLUMN "ocr_status" SET DEFAULT 'not_started'::text;--> statement-breakpoint
DROP TYPE "public"."file_pages_ocr_status_enum";--> statement-breakpoint
CREATE TYPE "public"."file_pages_ocr_status_enum" AS ENUM('not_started', 'ocr', 'success', 'failed');--> statement-breakpoint
ALTER TABLE "file_pages" ALTER COLUMN "ocr_status" SET DEFAULT 'not_started'::"public"."file_pages_ocr_status_enum";--> statement-breakpoint
ALTER TABLE "file_pages" ALTER COLUMN "ocr_status" SET DATA TYPE "public"."file_pages_ocr_status_enum" USING "ocr_status"::"public"."file_pages_ocr_status_enum";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "processing_status" "document_processing_status_enum" DEFAULT 'not_started' NOT NULL;
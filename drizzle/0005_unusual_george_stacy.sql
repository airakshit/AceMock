ALTER TABLE "document_files" ALTER COLUMN "processing_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "document_files" ALTER COLUMN "processing_status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."file_processing_status_enum";--> statement-breakpoint
CREATE TYPE "public"."file_processing_status_enum" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "document_files" ALTER COLUMN "processing_status" SET DEFAULT 'pending'::"public"."file_processing_status_enum";--> statement-breakpoint
ALTER TABLE "document_files" ALTER COLUMN "processing_status" SET DATA TYPE "public"."file_processing_status_enum" USING "processing_status"::"public"."file_processing_status_enum";--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "processing_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "processing_status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."document_processing_status_enum";--> statement-breakpoint
CREATE TYPE "public"."document_processing_status_enum" AS ENUM('pending', 'processing_files', 'extracting_questions', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "processing_status" SET DEFAULT 'pending'::"public"."document_processing_status_enum";--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "processing_status" SET DATA TYPE "public"."document_processing_status_enum" USING "processing_status"::"public"."document_processing_status_enum";--> statement-breakpoint
ALTER TABLE "file_pages" ALTER COLUMN "ocr_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "file_pages" ALTER COLUMN "ocr_status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."file_pages_ocr_status_enum";--> statement-breakpoint
CREATE TYPE "public"."file_pages_ocr_status_enum" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "file_pages" ALTER COLUMN "ocr_status" SET DEFAULT 'pending'::"public"."file_pages_ocr_status_enum";--> statement-breakpoint
ALTER TABLE "file_pages" ALTER COLUMN "ocr_status" SET DATA TYPE "public"."file_pages_ocr_status_enum" USING "ocr_status"::"public"."file_pages_ocr_status_enum";
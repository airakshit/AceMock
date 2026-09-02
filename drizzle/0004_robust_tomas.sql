CREATE TYPE "public"."file_processing_status_enum" AS ENUM('not_started', 'processing', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."file_pages_ocr_status_enum" AS ENUM('not_started', 'ocr', 'success', 'ocr_failed');--> statement-breakpoint
ALTER TABLE "processed_pages" RENAME TO "file_pages";--> statement-breakpoint
ALTER TABLE "file_pages" RENAME COLUMN "processing_status" TO "ocr_status";--> statement-breakpoint
ALTER TABLE "file_pages" RENAME COLUMN "raw_ocr_text" TO "ocr_text";--> statement-breakpoint
ALTER TABLE "file_pages" DROP CONSTRAINT "processed_pages_file_id_document_files_id_fk";
--> statement-breakpoint
ALTER TABLE "document_files" ADD COLUMN "processing_stauts" "file_processing_status_enum" DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "file_pages" ADD CONSTRAINT "file_pages_file_id_document_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."document_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."processed_page_status_enum";
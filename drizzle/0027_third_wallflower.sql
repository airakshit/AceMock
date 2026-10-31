ALTER TYPE "public"."document_processing_status_enum" ADD VALUE 'queued' BEFORE 'processing_files';--> statement-breakpoint
ALTER TABLE "document_files" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "deleted_at" timestamp with time zone;
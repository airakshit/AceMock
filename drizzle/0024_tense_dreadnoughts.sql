ALTER TABLE "document_files" ADD COLUMN "upload_complete_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_files" DROP COLUMN "updated_at";
ALTER TABLE "document_files" ALTER COLUMN "upload_status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "document_files" ALTER COLUMN "upload_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "document_files" ALTER COLUMN "upload_status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."file_upload_status_enum";--> statement-breakpoint
CREATE TYPE "public"."file_upload_status_enum" AS ENUM('pending', 'uploading', 'uploaded', 'failed', 'cancelled', 'expired');--> statement-breakpoint
ALTER TABLE "document_files" ALTER COLUMN "upload_status" SET DEFAULT 'pending'::"public"."file_upload_status_enum";--> statement-breakpoint
ALTER TABLE "document_files" ALTER COLUMN "upload_status" SET DATA TYPE "public"."file_upload_status_enum" USING "upload_status"::"public"."file_upload_status_enum";
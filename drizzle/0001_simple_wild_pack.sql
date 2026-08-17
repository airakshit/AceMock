CREATE TYPE "public"."document_content_type" AS ENUM('physics', 'maths', 'chemistry', 'english', 'mock-test', 'study-notes');--> statement-breakpoint
ALTER TABLE "account" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "account" CASCADE;--> statement-breakpoint
DROP TABLE "session" CASCADE;--> statement-breakpoint
DROP TABLE "user" CASCADE;--> statement-breakpoint
DROP TABLE "verification" CASCADE;--> statement-breakpoint
ALTER TABLE "document_files" RENAME COLUMN "storage_path" TO "storage_url";--> statement-breakpoint
ALTER TABLE "document_files" DROP CONSTRAINT "document_files_storage_path_unique";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "content_type" "document_content_type" NOT NULL;
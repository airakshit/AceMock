CREATE TYPE "public"."upload_session_status_enum" AS ENUM('active', 'completed', 'abandoned', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."file_upload_status_enum" ADD VALUE 'pending' BEFORE 'uploading';--> statement-breakpoint
ALTER TYPE "public"."file_upload_status_enum" ADD VALUE 'completed' BEFORE 'failed';--> statement-breakpoint
ALTER TYPE "public"."file_upload_status_enum" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."file_upload_status_enum" ADD VALUE 'expired';--> statement-breakpoint
CREATE TABLE "upload_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"status" "upload_session_status_enum" DEFAULT 'active' NOT NULL,
	"last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recovery_expires_at" timestamp with time zone NOT NULL,
	"progress" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"end_reason" text
);
--> statement-breakpoint
ALTER TABLE "document_files" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "document_files" ADD COLUMN "content_probe" text;--> statement-breakpoint
ALTER TABLE "document_files" ADD COLUMN "upload_ref" text;--> statement-breakpoint
ALTER TABLE "document_files" ADD COLUMN "upload_ref_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_active_upload_session_per_document" ON "upload_sessions" USING btree ("document_id") WHERE "upload_sessions"."status" = 'active';--> statement-breakpoint
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_session_id_upload_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."upload_sessions"("id") ON DELETE set null ON UPDATE no action;
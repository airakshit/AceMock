ALTER TABLE "document_files" DROP CONSTRAINT "document_files_document_id_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "file_pages" ADD COLUMN "is_relevant" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
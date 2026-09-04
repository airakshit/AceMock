ALTER TABLE "file_pages" DROP CONSTRAINT "file_pages_file_id_document_files_id_fk";
--> statement-breakpoint
ALTER TABLE "file_pages" ADD CONSTRAINT "file_pages_file_id_document_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."document_files"("id") ON DELETE cascade ON UPDATE no action;
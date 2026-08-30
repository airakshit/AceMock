import {
  pgTable,
  pgEnum,
  uuid,
  timestamp,
  text,
  numeric,
} from "drizzle-orm/pg-core";
import { documents } from "./documents";

export const fileUploadStatusEnum = pgEnum("file_upload_status_enum", [
  "uploading",
  "uploaded",
  "failed",
]);

export const documentFiles = pgTable("document_files", {
  id: uuid("id").primaryKey().notNull(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id),

  filename: text("filename").notNull(),
  fileSize: numeric("file_size").notNull(),

  mimeType: text("mime_type").notNull(),
  storagePath: text("storage_path").notNull(),
  uploadStatus: fileUploadStatusEnum("upload_status").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});

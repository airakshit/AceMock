import {
  pgTable,
  pgEnum,
  uuid,
  timestamp,
  text,
  bigint,
} from "drizzle-orm/pg-core";
import { documents } from "./documents";

export const fileUploadStatusEnum = pgEnum("file_upload_status_enum", [
  "uploading",
  "uploaded",
  "failed",
]);

export const fileProcessingStatusEnum = pgEnum("file_processing_status_enum", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const documentFiles = pgTable("document_files", {
  id: uuid("id").primaryKey().notNull(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),

  filename: text("filename").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),

  mimeType: text("mime_type").notNull(),
  storagePath: text("storage_path").notNull(),
  uploadStatus: fileUploadStatusEnum("upload_status")
    .notNull()
    .default("uploading"),

  processingStatus: fileProcessingStatusEnum("processing_status")
    .notNull()
    .default("pending"),

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

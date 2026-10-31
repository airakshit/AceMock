import {
  pgTable,
  pgEnum,
  uuid,
  timestamp,
  text,
  bigint,
} from "drizzle-orm/pg-core";
import { documents } from "./documents";
import { uploadSessions } from "./upload-sessions";

export const fileUploadStatusEnum = pgEnum("file_upload_status_enum", [
  "pending",
  "uploading",
  "uploaded",
  "failed",
  "cancelled",
  "expired",
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

  /**
   * The upload session that created/owns this in-flight upload.
   * Exposes the file to the session's liveness, resume authorization and
   * cancellation rules (see upload_sessions + UploadFlow.md).
   */
  sessionId: uuid("session_id").references(() => uploadSessions.id, {
    onDelete: "set null",
  }),

  filename: text("filename").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),

  mimeType: text("mime_type").notNull(),
  storagePath: text("storage_path").notNull(),

  contentProbe: text("content_probe"),

  uploadStatus: fileUploadStatusEnum("upload_status")
    .notNull()
    .default("pending"),

  processingStatus: fileProcessingStatusEnum("processing_status")
    .notNull()
    .default("pending"),

  uploadRef: text("upload_ref"),

  uploadRefCreatedAt: timestamp("upload_ref_created_at", {
    withTimezone: true,
  }),

  uploadCompleteAt: timestamp("upload_complete_at", { withTimezone: true }),

  // For soft delete feature.
  deletedAt: timestamp("deleted_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

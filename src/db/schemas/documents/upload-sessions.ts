import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  timestamp,
  text,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { documents } from "./documents";
import { user } from "@/db/schemas/auth";

/**
 * Upload session states.
 *
 * `live` / `interrupted` / `expired` (from UploadFlow.md) are DERIVED states
 * computed from `status` + `lastHeartbeatAt` + `recoveryExpiresAt` — they are
 * deliberately not stored.
 */
export const uploadSessionStatusEnum = pgEnum("upload_session_status_enum", [
  "active",
  "completed",
  "abandoned",
  "cancelled",
]);

/**
 * One row per document-upload attempt.
 *
 * The server owns the upload session: it authorizes recovery, tracks
 * liveness (see lastHeartbeatAt) and enforces the business rule
 * "at most one ACTIVE session per document" via the partial unique index
 * below. Historical (terminal) sessions are kept for auditability.
 */
export const uploadSessions = pgTable(
  "upload_sessions",
  {
    id: uuid("id").primaryKey().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),

    status: uploadSessionStatusEnum("status").notNull().default("active"),

    /** Last heartbeat accepted from the uploading client. */
    lastHeartbeatAt: timestamp("last_heartbeat_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    /** Absolute deadline after which the attempt can no longer be resumed. */
    recoveryExpiresAt: timestamp("recovery_expires_at", {
      withTimezone: true,
    }).notNull(),

    /** Optional per-file progress cache (documentFileId → { status, ... }). */
    progress: jsonb("progress").$type<Record<string, unknown>>().default({}),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endReason: text("end_reason"),
  },
  
  (table) => [
    // Business rule: at most one active session per document.
    uniqueIndex("uq_active_upload_session_per_document")
      .on(table.documentId)
      .where(sql`${table.status} = 'active'`),
  ],
);

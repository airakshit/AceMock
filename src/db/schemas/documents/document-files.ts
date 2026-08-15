import {
    pgTable,
    pgEnum,
    uuid,
    timestamp,
    text,
    bigint,
} from "drizzle-orm/pg-core";
import { documents } from "./documents";

export const documentFileTypeEnum = pgEnum("document_file_type", [
    "pdf",
    "image",
]);

export const documentFileStatusEnum = pgEnum("document_file_status", [
    "uploading",
    "uploaded",
    "failed",
]);

export const documentFiles = pgTable("document_files", {
    id: uuid("id").primaryKey(),

    documentId: uuid("document_id")
        .notNull()
        .references(() => documents.id, {
            onDelete: "cascade",
        }),

    originalFilename: text("original_filename").notNull(),

    mimeType: text("mime_type").notNull(),

    fileType: documentFileTypeEnum("file_type").notNull(),

    fileSize: bigint("file_size", {
        mode: "number",
    }).notNull(),

    /**
     * Path inside Supabase Storage.
     *
     * Example:
     *
     * users/{userId}/documents/{documentId}/files/{fileId}/original.pdf
     */
    storagePath: text("storage_path").notNull().unique(),

    status: documentFileStatusEnum("status").notNull().default("uploading"),

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

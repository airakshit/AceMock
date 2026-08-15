import {
    pgTable,
    pgEnum,
    uuid,
    integer,
    text,
    jsonb,
    uniqueIndex,
    timestamp,
} from "drizzle-orm/pg-core";
import { documentFiles } from "./document-files";

export const documentPageStatusEnum = pgEnum("document_page_status", [
    "pending",
    "processing",
    "completed",
    "failed",
]);

export const documentPages = pgTable(
    "document_pages",
    {
        id: uuid("id").primaryKey(),

        documentFileId: uuid("document_file_id")
            .notNull()
            .references(() => documentFiles.id, {
                onDelete: "cascade",
            }),

        /**
         * Page number within the source file.
         *
         * For a PDF:
         *   1, 2, 3, ...
         *
         * For a standalone image:
         *   usually 1.
         */
        pageNumber: integer("page_number").notNull(),

        /**
         * Storage path of the normalized page image.
         *
         * Example:
         *
         * users/{userId}/documents/{documentId}/pages/{pageId}.webp
         */
        storagePath: text("storage_path").unique(),
        width: integer("width"),
        height: integer("height"),
        status: documentPageStatusEnum("status").notNull().default("pending"),

        /**
         * Raw output returned by Qwen/vision model.
         *
         * Keep this for debugging/re-processing.
         */
        rawModelOutput: text("raw_model_output"),

        /**
         * Structured content extracted from the page.
         *
         * Example:
         *
         * {
         *   "questions": [...]
         * }
         */
        extractedContent: jsonb("extracted_content"),

        visionModel: text("vision_model"),
        errorMessage: text("error_message"),

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
    },

);

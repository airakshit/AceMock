import {
    pgTable,
    pgEnum,
    uuid,
    integer,
    text,
    jsonb,
    timestamp,
} from "drizzle-orm/pg-core";
import { documentFiles } from "./document-files";

export const documentPageStatusEnum = pgEnum("document_page_status", [
    "pending",
    "processing",
    "completed",
    "failed",
]);

export const documentPages = pgTable("document_pages", {
    id: uuid("id").primaryKey(),

    documentFileId: uuid("document_file_id")
        .notNull()
        .references(() => documentFiles.id, {
            onDelete: "cascade",
        }),
    pageNumber: integer("page_number").notNull(),
    storagePath: text("storage_path").unique(),
    width: integer("width"),
    height: integer("height"),
    status: documentPageStatusEnum("status").notNull().default("pending"),

    rawModelOutput: text("raw_model_output"),
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
});

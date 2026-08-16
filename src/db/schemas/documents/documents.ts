import { pgEnum, pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "@/db/schemas/auth";

export const documentStatusEnum = pgEnum("document_status", [
    "draft",
    "uploading",
    "processing",
    "ready",
    "failed",
    "deleted",
]);

export const documentContentTypeEnum = pgEnum("document_status", [
    "physics",
    "maths",
    "chemistry",
    "english",
    "mock-test",
    "sudy-notes",
]);

export const documentsTable = "documents";

export const documents = pgTable(documentsTable, {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    description: text("description"),
    contentType: documentContentTypeEnum("content_type").notNull(),
    status: documentStatusEnum("status").notNull().default("draft"),

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

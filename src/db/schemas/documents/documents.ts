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

export const documents = pgTable("documents", {
    id: uuid("id").primaryKey(),
    userId: uuid("id")
        .notNull()
        .references(() => user.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
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

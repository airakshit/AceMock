import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { user } from "@/db/schemas/auth";

export const documentsTable = "documents";

export const documentProcessingStatusEnum = pgEnum(
  "document_processing_status_enum",
  ["pending", "processing_files", "extracting_questions", "merging_questions", "completed", "failed"],
);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id),
  title: text("title").notNull(),
  description: text("description"),
  processingStatus: documentProcessingStatusEnum("processing_status")
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

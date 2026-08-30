import {
  pgTable,
  pgEnum,
  uuid,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { documentFiles } from "./document-files";

export const processedPageStatusEnum = pgEnum("processed_page_status_enum", [
  "processing",
  "completed",
  "failed",
]);

export const processedPages = pgTable("processed_pages", {
  id: uuid("id").primaryKey().notNull(),

  fileId: uuid("file_id")
    .notNull()
    .references(() => documentFiles.id),

  pageNo: integer("page_no").notNull().default(0),

  processingStatus: processedPageStatusEnum("processing_status")
    .notNull()
    .default("processing"),

  rawOcrText: text("raw_ocr_text").notNull(),
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

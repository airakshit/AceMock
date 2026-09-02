import {
  pgTable,
  pgEnum,
  uuid,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { documentFiles } from "./document-files";

export const filePageOCRStatusEnum = pgEnum("file_pages_ocr_status_enum", [
  "not_started",
  "ocr",
  "success",
  "ocr_failed",
]);

export const filePages = pgTable("file_pages", {
  id: uuid("id").primaryKey().notNull(),

  fileId: uuid("file_id")
    .notNull()
    .references(() => documentFiles.id),

  pageNo: integer("page_no").notNull().default(0),

  ocrStatus: filePageOCRStatusEnum("ocr_status")
    .notNull()
    .default("not_started"),

  ocrText: text("ocr_text"),

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

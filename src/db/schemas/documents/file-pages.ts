import {
  pgTable,
  pgEnum,
  uuid,
  integer,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { documentFiles } from "./document-files";

export const filePageOCRStatusEnum = pgEnum("file_pages_ocr_status_enum", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const filePages = pgTable("file_pages", {
  id: uuid("id").primaryKey().notNull(),

  fileId: uuid("file_id")
    .notNull()
    .references(() => documentFiles.id, { onDelete: "cascade" }),

  pageNo: integer("page_no").notNull().default(0),

  ocrStatus: filePageOCRStatusEnum("ocr_status").notNull().default("pending"),

  ocrText: text("ocr_text"),

  survivedValidation: boolean("survived_validation").notNull().default(true),
  isRelevant: boolean("is_relevant").notNull().default(true),

  // Some metadata columns for internal testing and tracking
  ocrModel: text("ocr_model"),
  fnVersion: integer("fn_version").notNull().default(1),

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

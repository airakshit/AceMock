import {
  pgTable,
  text,
  uuid,
  integer,
  jsonb,
  timestamp,
  varchar,
  pgEnum,
} from "drizzle-orm/pg-core";
import { user } from "../auth";
import { questions } from "./questions";

export const questionReportTypeEnum = pgEnum("question_report_type_enum", [
  "invalid_question",
  "invalid_options",
  "invalid_solution",
  "incomplete_solution",
  "rendering_error",
  "other",
]);

export const questionReports = pgTable("question_reports", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .references(() => user.id)
    .notNull(),
  questionId: uuid("question_id")
    .references(() => questions.id)
    .notNull(),
  reportType: questionReportTypeEnum("report_type").notNull(),
  description: text("description"),

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

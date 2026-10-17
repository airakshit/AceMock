import {
  pgTable,
  text,
  uuid,
  integer,
  jsonb,
  timestamp,
  varchar,
  pgEnum,
  index,
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

export const questionReports = pgTable(
  "question_reports",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    questionId: uuid("question_id")
      .references(() => questions.id, { onDelete: "cascade" })
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
  },
  (table) => [
    // Admin triage pages the table `ORDER BY created_at DESC, id DESC`,
    // optionally narrowed to one report type. Every composite index leads
    // with the filter column so the page reads straight off the index in
    // cursor order — same shape as the mock_tests search indexes.
    index("question_reports_created_at_id_idx").on(table.createdAt, table.id),
    index("question_reports_report_type_created_at_id_idx").on(
      table.reportType,
      table.createdAt,
      table.id,
    ),
    // Report creation dedupes on (user, question, type) — currently the
    // only point lookup into this table.
    index("question_reports_user_question_type_idx").on(
      table.userId,
      table.questionId,
      table.reportType,
    ),
    // Per-question rollup used by the reports page and its summary.
    index("question_reports_question_id_idx").on(table.questionId),
  ],
);

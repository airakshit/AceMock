import { char, pgTable, timestamp, uuid, check, unique } from "drizzle-orm/pg-core";
import { questions } from "../questions";
import { sql } from "drizzle-orm";
import { mockTestsAttempts } from "./mock-attempts";

export const mockAttemptAnswers = pgTable(
  "mock_attempt_answers",
  {
    id: uuid("id").primaryKey(),
    attemptId: uuid("attempt_id")
      .references(() => mockTestsAttempts.id)
      .notNull(),
    questionId: uuid("question_id")
      .references(() => questions.id, { onDelete: "cascade" })
      .notNull(),
    selectedOption: char("selected_option").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("option_valid", sql`${table.selectedOption} IN ('A', 'B', 'C', 'D')`),
    // An attempt can store exactly one (latest) answer per question.
    // Enables ON CONFLICT upserts from the answer submission flow.
    unique("mock_attempt_answers_attempt_id_question_id_unique").on(
      table.attemptId,
      table.questionId,
    ),
  ],
);

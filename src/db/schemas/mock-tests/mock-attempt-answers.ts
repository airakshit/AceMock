import { char, pgTable, timestamp, uuid, check } from "drizzle-orm/pg-core";
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
  ],
);

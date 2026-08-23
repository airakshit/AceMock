import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { questions } from "../questions";
import { mockTests } from "./mock-tests";

export const mockTestsQuestions = pgTable("mock-tests-questions", {
  id: uuid("id").primaryKey(),
  mockTestId: uuid("mock_test_id")
    .references(() => mockTests.id)
    .notNull(),
  questionId: uuid("question_id")
    .references(() => questions.id)
    .notNull(),
  position: integer("position").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

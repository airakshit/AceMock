import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { mockTests } from "./mock-tests";
import { user } from "../auth";

export const mockAttemptStatusEnum = pgEnum("mock_attempt_status_enum", [
  "in_progress",
  "completed",
]);

export const mockTestsAttempts = pgTable("mock_tests_attempts", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .references(() => user.id)
    .notNull(),
  mockTestId: uuid("mock_test_id")
    .references(() => mockTests.id)
    .notNull(),

  status: mockAttemptStatusEnum("status").notNull().default("in_progress"),

  submittedAt: timestamp("submitted_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

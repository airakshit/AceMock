import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "../auth";


export const mockTests = pgTable("mock_tests", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").references(() => user.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  totalMarks: integer("total_marks").notNull(),
  negativePercentagePerQuestion: integer("negative_percent_per_question")
    .notNull()
    .default(0),
  duration_seconds: integer("duration_seconds").notNull(),
  maxAttempts: integer("max_attempts").default(1).notNull(),
  instructions: text("instructions"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

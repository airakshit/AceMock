import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth";

export const mockTests = pgTable("mock-tests", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").references(() => user.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  duration_seconds: integer("duration_seconds").notNull(),
  totalMarks: integer("total_marks").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

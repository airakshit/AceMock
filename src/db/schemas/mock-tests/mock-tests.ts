import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "../auth";

export const visibilityEnum = pgEnum("visibility_enum", ["public", "private"]);

export const mockTests = pgTable("mock-tests", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").references(() => user.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  totalMarks: integer("total_marks").notNull(),
  duration_seconds: integer("duration_seconds").notNull(),
  visibility: visibilityEnum("visibility").notNull().default("public"),

  instructions: text("instructions"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

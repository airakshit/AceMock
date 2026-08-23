import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { subjects } from "./subjects";

export const topics = pgTable("topics", {
  id: uuid("id").primaryKey(),

  subjectId: uuid("subject_id")
    .notNull()
    .references(() => subjects.id, {
      onDelete: "cascade",
    }),

  name: text("name").notNull(),

  slug: text("slug").notNull(),

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

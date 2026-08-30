import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { subjects } from "./subjects";
import { v7 as uuidv7 } from "uuid";

export const sections = pgTable("sections", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  subjectId: uuid("subject_id")
    .references(() => subjects.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),

  slug: text("slug").notNull().unique(),

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

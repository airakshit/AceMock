import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),

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

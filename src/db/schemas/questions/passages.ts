import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";

export const passages = pgTable("passages", {
  id: uuid("id").primaryKey(),

  content: text("content").notNull(),

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

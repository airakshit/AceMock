import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { sections } from "./sections";
import { v7 as uuidv7 } from "uuid";

export const chapters = pgTable("chapters", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),

  sectionId: uuid("section_id")
    .notNull()
    .references(() => sections.id, {
      onDelete: "cascade",
    }),

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

import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { user } from "@/db/schemas/auth";

export const documentsTable = "documents";

// export const documentQuestionTypeEnum = pgEnum("document_question_type_enum", [
//   "",
//   "mcq",
// ]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id),
  title: text("title").notNull(),
  description: text("description"),
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

import { pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth";
import { questions } from "./questions";

export const questionBookmarks = pgTable(
  "question_bookmarks",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    questionId: uuid("question_id")
      .references(() => questions.id, { onDelete: "cascade" })
      .notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // A user can bookmark a question only once.
    unique("question_bookmarks_user_id_question_id_unique").on(
      table.userId,
      table.questionId,
    ),
  ],
);

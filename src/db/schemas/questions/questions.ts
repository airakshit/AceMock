import {
  pgTable,
  text,
  uuid,
  integer,
  jsonb,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { subjects } from "./subjects";
import { topics } from "./topics";
import { passages } from "./passages";
import { documentPages } from "../documents";

export const questions = pgTable("questions", {
  id: uuid("id").primaryKey(),
  sourcePageId: uuid("source_page_id")
    .references(() => documentPages.id, { onDelete: "cascade" })
    .notNull(),

  subjectId: uuid("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "restrict" }),

  topicId: uuid("topic_id").references(() => topics.id, {
    onDelete: "restrict",
  }),

  passageId: uuid("passage_id").references(() => passages.id, {
    onDelete: "set null",
  }),

  question: text("question").notNull(),

  options: jsonb("options")
    .$type<
      {
        key: string;
        text: string;
      }[]
    >()
    .notNull(),

  correctOption: varchar("correct_option", {
    length: 1,
  }).notNull(),

  marks: integer("marks").notNull().default(1),

  difficulty: varchar("difficulty", {
    length: 20,
  }),

  solution: text("solution"),

  diagramUrl: text("diagram_url"),

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

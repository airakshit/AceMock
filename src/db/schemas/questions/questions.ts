import {
  pgTable,
  text,
  uuid,
  integer,
  jsonb,
  timestamp,
  varchar,
  pgEnum,
} from "drizzle-orm/pg-core";
import { chapters } from "./chapters";
import { passages } from "./passages";
import { documentFiles } from "../documents";

export const questionDifficutlyEnum = pgEnum("question_difficulty_enum", [
  "easy",
  "medium",
  "hard",
]);

export const questions = pgTable("questions", {
  id: uuid("id").primaryKey(),
  question: text("question").notNull(),

  chapterId: uuid("chapter_id")
    .references(() => chapters.id, {
      onDelete: "restrict",
    })
    .notNull(),
  passageId: uuid("passage_id").references(() => passages.id, {
    onDelete: "restrict",
  }),
  fileId: uuid("file_id").references(() => documentFiles.id, {
    onDelete: "set null",
  }),

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

  difficulty: questionDifficutlyEnum("difficulty").default("medium").notNull(),

  diagram_url: text("diagram_url"),
  hint: text("hint"),
  solution: text("solution"),
  solution_diagram_url: text("solution_diagram_url"),

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

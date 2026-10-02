import {
  pgTable,
  text,
  uuid,
  integer,
  jsonb,
  timestamp,
  pgEnum,
  char,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { chapters } from "./chapters";
import { passages } from "./passages";
import { documentFiles } from "../documents";

export const questionDifficutlyEnum = pgEnum("question_difficulty_enum", [
  "easy",
  "medium",
  "hard",
]);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey(),
    question: text("question").notNull(),

    chapterId: uuid("chapter_id").references(() => chapters.id, {
      onDelete: "set null",
    }),

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

    correctOption: char("correct_option", {
      length: 1,
    }).notNull(),

    marks: integer("marks").notNull().default(1),

    difficulty: questionDifficutlyEnum("difficulty")
      .default("medium")
      .notNull(),

    questionDiagram: text("question_diagram"),
    hint: text("hint"),
    solution: text("solution"),
    solutionDiagram: text("solution_diagram"), // Diagrams will be svg or image urls.

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
  },
  (table) => [
    check("option_valid", sql`${table.correctOption} IN ('A', 'B', 'C', 'D')`),
  ],
);

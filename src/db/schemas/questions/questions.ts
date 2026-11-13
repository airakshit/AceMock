import {
  pgTable,
  text,
  uuid,
  integer,
  boolean,
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

/**
 * Single source of truth for every machine-readable failure reason
 * persisted on the questions table — the `not_ready_reason` column stores an
 * array of these values.
 *
 * Groups (the pipeline codes in
 * src/inngest/functions/v3/extract-questions/readiness.ts — sync asserted
 * by tests):
 * - readiness gaps:    "missing question" | "missing option" |
 *                      "missing solution" | "missing answer key"
 * - figure resolution: "figure_not_found" (stage 2 read the question/option
 *                      text and found no matching diagram) |
 *                      "figure_unresolved" (a requested part never got
 *                      bounding boxes)
 */
export const FAILURE_REASONS = [
  "missing question",
  "missing option",
  "missing solution",
  "missing answer key",
  "figure_not_found",
  "figure_unresolved",
] as const;

export type QuestionFailureReason = (typeof FAILURE_REASONS)[number];

export const failureReasonEnum = pgEnum("failure_reason_enum", FAILURE_REASONS);

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

    // Comma-separated list of figures associated with the question
    questionDiagrams: text("question_diagrams"),
    solutionDiagram: text("solution_diagram"),

    /**
     * False when the source OCR reported a figure for this question (stem,
     * solution, or an option) that could never be localized/cropped during
     * extraction. True when every requested figure was resolved — or the
     * question carried no figures at all.
     */
    figureResolved: boolean("figure_resolved").notNull().default(true),

    isReady: boolean("is_ready").notNull().default(false),
    notReadyReason: failureReasonEnum("not_ready_reason").array(),

    hint: text("hint"),
    solution: text("solution"),

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

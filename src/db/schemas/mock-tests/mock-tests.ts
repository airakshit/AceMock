import {
  boolean,
  check,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { user } from "../auth";
import { documents } from "../documents";
import { subjects, sections, chapters } from "../questions";

// What the mock test is specifically associated with
export const mockTestScopeEnum = pgEnum("mock_test_scope", [
  "ioe_model",
  "subject",
  "section",
  "chapter",
  "miscellaneous",
]);

export const mockTests = pgTable(
  "mock_tests",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("user_id").references(() => user.id, {
      onDelete: "cascade",
    }),

    // Present when the mock test was generated from a document.
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),

    byAdmin: boolean("by_admin").default(true).notNull(),
    scope: mockTestScopeEnum("scope").notNull(),

    subjectId: uuid("subject_id").references(() => subjects.id, {
      onDelete: "set null",
    }),
    sectionId: uuid("section_id").references(() => sections.id, {
      onDelete: "set null",
    }),
    chapterId: uuid("chapter_id").references(() => chapters.id, {
      onDelete: "set null",
    }),

    name: text("name").notNull(),
    totalMarks: integer("total_marks").notNull(),
    negativePercentagePerQuestion: integer("negative_percent_per_question")
      .notNull()
      .default(0),
    durationSeconds: integer("duration_seconds").notNull(),
    maxAttempts: integer("max_attempts").notNull().default(1),
    allowUntimed: boolean("allow_untimed").notNull().default(true),
    instructions: text("instructions"),

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
    check(
      "mock_test_scope_reference_check",
      sql`
        (
          ${table.scope} = 'ioe_model'
          AND ${table.subjectId} IS NULL
          AND ${table.sectionId} IS NULL
          AND ${table.chapterId} IS NULL
        )
        OR
        (
          ${table.scope} = 'miscellaneous'
          AND ${table.subjectId} IS NULL
          AND ${table.sectionId} IS NULL
          AND ${table.chapterId} IS NULL
        )
        OR
        (
          ${table.scope} = 'subject'
          AND ${table.subjectId} IS NOT NULL
          AND ${table.sectionId} IS NULL
          AND ${table.chapterId} IS NULL
        )
        OR
        (
          ${table.scope} = 'section'
          AND ${table.subjectId} IS NOT NULL
          AND ${table.sectionId} IS NOT NULL
          AND ${table.chapterId} IS NULL
        )
        OR
        (
          ${table.scope} = 'chapter'
          AND ${table.subjectId} IS NOT NULL
          AND ${table.sectionId} IS NOT NULL
          AND ${table.chapterId} IS NOT NULL
        )
      `,
    ),
  ],
);

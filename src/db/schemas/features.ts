import {
    pgTable,
    bigint,
    text,
    integer,
    jsonb,
    timestamp,
    varchar,
    unique,
    index,
} from "drizzle-orm/pg-core";


export const subjects = pgTable("subjects", {
    id: bigint("id", { mode: "number" })
        .primaryKey()
        .generatedByDefaultAsIdentity(),

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

export const topics = pgTable(
    "topics",
    {
        id: bigint("id", { mode: "number" })
            .primaryKey()
            .generatedByDefaultAsIdentity(),
        subjectId: bigint("subject_id", { mode: "number" })
            .notNull()
            .references(() => subjects.id, {
                onDelete: "cascade",
            }),
        name: text("name").notNull(),
        slug: text("slug").notNull(),
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
        unique("topics_subject_id_slug_unique").on(table.subjectId, table.slug),
        index("topics_subject_id_idx").on(table.subjectId),
    ],
);

export const passages = pgTable("passages", {
    id: bigint("id", { mode: "number" })
        .primaryKey()
        .generatedByDefaultAsIdentity(),
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

export const questions = pgTable(
    "questions",
    {
        id: bigint("id", { mode: "number" })
            .primaryKey()
            .generatedByDefaultAsIdentity(),
        topicId: bigint("topic_id", { mode: "number" })
            .notNull()
            .references(() => topics.id, {
                onDelete: "restrict",
            }),
        passageId: bigint("passage_id", { mode: "number" }).references(
            () => passages.id,
            {
                onDelete: "set null",
            },
        ),
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
    },
    (table) => [
        index("questions_topic_id_idx").on(table.topicId),
        index("questions_passage_id_idx").on(table.passageId),
        index("questions_difficulty_idx").on(table.difficulty),
    ],
);



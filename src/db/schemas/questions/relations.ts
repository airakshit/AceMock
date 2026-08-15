import { relations } from "drizzle-orm";
import { subjects } from "./subjects";
import { passages } from "./passages";
import { topics } from "./topics";
import { questions } from "./questions";

export const subjectsRelations = relations(subjects, ({ many }) => ({
    topics: many(topics),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
    subject: one(subjects, {
        fields: [topics.subjectId],
        references: [subjects.id],
    }),

    questions: many(questions),
}));

export const passagesRelations = relations(passages, ({ many }) => ({
    questions: many(questions),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
    topic: one(topics, {
        fields: [questions.topicId],
        references: [topics.id],
    }),

    passage: one(passages, {
        fields: [questions.passageId],
        references: [passages.id],
    }),
}));

import { relations } from "drizzle-orm";
import { subjects, topics, passages, questions } from "./features";

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

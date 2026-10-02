// This file contains the payload to be consumed by services or server actions.
// Accessed by: services only

import {
    QuestionDifficulty,
    QuestionOption,
    QuestionOptionKey,
    QuestionReportType,
} from "../types";

/**
 * File metadata command payload for question diagram attachments.
 */
export interface CreateQuestionFileCommand {
    clientFileId: string;
    name: string;
    size: number;
    type: string;
    field: "diagram" | "solution_diagram";
}

/**
 * High-level command input for the service layer to create a new question.
 */
export interface CreateQuestionPayloadCommand {
    chapterSlug: string;
    question: string;
    options: QuestionOption[];
    correctOption: QuestionOptionKey;
    marks: number;
    difficulty: QuestionDifficulty;
    hint?: string;
    solution?: string;
    files: CreateQuestionFileCommand[];
}

/**
 * Payload for bookmarking a question for the current user.
 */
export interface CreateQuestionBookmarkPayloadCommand {
    questionId: string;
}

/**
 * Payload for removing a bookmark from a question for the current user.
 */
export interface RemoveQuestionBookmarkPayloadCommand {
    questionId: string;
}

/**
 * Payload for reporting a question with a predefined category.
 */
export interface CreateQuestionReportPayloadCommand {
    questionId: string;
    reportType: QuestionReportType;
    /** Optional free-text detail, surfaced to admins reviewing the report. */
    description?: string;
}
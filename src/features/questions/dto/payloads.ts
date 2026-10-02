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

/**
 * Payload for one cursor-paginated page of the user's bookmarked questions.
 * `cursor` is the opaque token returned by the previous page — there is no
 * limit/offset anywhere in the flow.
 */
export interface GetBookmarkedQuestionsPayloadCommand {
    cursor?: string;
    /** Subject slug filter; omitted/empty means all subjects. */
    subjectSlug?: string;
    /**
     * Load toggle: `true` returns each question together with its correct
     * option and solution; omitted/false (the default) returns questions
     * + options only.
     */
    includeSolution?: boolean;
}

/**
 * Payload for revealing the solution (and correct option) of a single
 * bookmarked question.
 */
export interface GetQuestionSolutionPayloadCommand {
    questionId: string;
}
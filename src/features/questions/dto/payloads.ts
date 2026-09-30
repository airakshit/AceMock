// This file contains the payload to be consumed by services or server actions.
// Accessed by: services only

import { QuestionDifficulty, QuestionOption, QuestionOptionKey } from "../types";

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
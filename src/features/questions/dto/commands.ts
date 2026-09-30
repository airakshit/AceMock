// Contains the input for the repositories. For db operations.
// Accessed by: services and repositories

import { QuestionDifficulty, QuestionOption } from "../types";


export interface CreateQuestionItemCommand {
  id: string;
  question: string;
  options: QuestionOption[];
  correctOption: string;
  marks: number;
  difficulty: QuestionDifficulty;
  chapterId?: string | null;
  fileId?: string | null;
  passageId?: string | null;
  hint?: string | null;
  solution?: string | null;
  questionDiagram?: string | null; // Diagrams will either be a url or <svg> text
  solutionDiagram?: string | null;
}


/**
 * Command for updating the chapter assignment of a question.
 */
export interface UpdateQuestionChapterCommand {
  questionId: string;
  chapterId: string;
}

/**
 * Item for batch updating question chapter assignments.
 */
export interface UpdateManyQuestionChaptersCommand {
  id: string;
  chapterId: string;
}

/**
 * Command for deleting questions by associated file IDs.
 */
export interface DeleteQuestionsByFileIdsCommand {
  fileIds: string[];
}

/**
 * Command for creating a single passage.
 */
export interface CreatePassageCommand {
  content: string;
}

/**
 * Command for creating multiple passages in bulk.
 */
export interface CreateManyPassagesCommand {
  passageContents: string[];
}

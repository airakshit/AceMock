import type {
  QuestionDifficulty,
  QuestionOption,
} from "@/features/questions/types";

/**
 * A resolved question entity ready for database persistence after merging
 * cross-page splits, solutions, answer keys, and continuation states.
 */
export interface ResolvedQuestion {
  serialNo: number;
  fileId: string;
  question: string;
  options: QuestionOption[];
  correctOption: string;
  marks: number;
  difficulty: QuestionDifficulty;
  subject?: string;
  hint?: string | null;
  solution?: string | null;
  diagram_url?: string | null;
  solution_diagram_url?: string | null;
  passageId?: string | null;
  passageContent?: string | null;
  svgQuestion?: string | null;
  svgSolution?: string | null;
}

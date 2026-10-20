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
  /** Every page that contributed text for this item, in read order. */
  pageNos: number[];
  question: string;
  options: QuestionOption[];
  correctOption: string;
  marks: number;
  difficulty: QuestionDifficulty;
  subject?: string;
  /** Opaque flag from stage 1: this item contains at least one figure. */
  hasFigure?: boolean;
  hint?: string | null;
  solution?: string | null;
  diagram_url?: string | null;
  solution_diagram_url?: string | null;
  passageId?: string | null;
  passageContent?: string | null;
  svgQuestion?: string | null;
  svgSolution?: string | null;
}

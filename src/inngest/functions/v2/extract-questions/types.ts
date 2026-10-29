import type {
  QuestionDifficulty,
  QuestionOption,
} from "@/features/questions/types";

/**
 * A figure location reported by the OCR model.
 * Normalized coordinates (0-1) on the full page image, origin top-left.
 */
export interface BoundingBox {
  /** Top edge of the box, measured from the top of the page (0-1). */
  yMin: number;
  /** Left edge of the box, measured from the left of the page (0-1). */
  xMin: number;
  /** Bottom edge of the box, measured from the top of the page (0-1). */
  yMax: number;
  /** Right edge of the box, measured from the left of the page (0-1). */
  xMax: number;
}

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
  /** Bounding boxes of each separate diagram in the question stem. */
  questionFigures?: BoundingBox[];
  /** Bounding boxes of each separate diagram in the solution. */
  solutionFigures?: BoundingBox[];
  /** Per-option diagram bounding boxes. Each option with its own diagram gets its own independent box. */
  optionFigures?: {
    A?: BoundingBox;
    B?: BoundingBox;
    C?: BoundingBox;
    D?: BoundingBox;
  };
  hint?: string | null;
  solution?: string | null;
  diagram_url?: string | null;
  solution_diagram_url?: string | null;
  passageId?: string | null;
  passageContent?: string | null;
}

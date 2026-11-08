/**
 * V3 extract-questions types — PATH-BASED resolved questions.
 */
import type {
  QuestionDifficulty,
  QuestionOption,
} from "@/features/questions/types";
import type { BoundingBox, SuperEntity } from "../ocr-page/super-schema";

/**
 * A resolved question entity ready for database persistence after merging
 * cross-page splits, parent stems, solutions, answer keys, and passages.
 * Identity and ordering come from the printed PATH chain (see
 * ../ocr-page/path-utils), not a serial number.
 */
export interface ResolvedQuestion {
  fileId: string;
  /** Every page that contributed text for this item, in read order. */
  pageNos: number[];
  /** The verbatim printed label chain, e.g. ["4", "ii"]. */
  path: string[];
  /** Human-readable label, e.g. "4(ii)". */
  label: string;
  /** Canonical join key (also used to key figures and answer rows). */
  pathKey: string;
  question: string;
  /**
   * True when this question/subquestion can stand alone without the parent
   * stem or content from other pages. Used during stitching to decide
   * whether to join the parent stem into subquestion text.
   */
  isStandalone: boolean;
  options: QuestionOption[];
  correctOption: string;
  marks: number;
  difficulty: QuestionDifficulty;
  subject?: string;
  /** Bounding boxes of each separate diagram in the question stem. */
  questionFigures?: BoundingBox[];
  /** Bounding boxes of each separate diagram in the solution. */
  solutionFigures?: BoundingBox[];
  /** Per-option diagram bounding boxes. */
  optionFigures?: {
    A?: BoundingBox;
    B?: BoundingBox;
    C?: BoundingBox;
    D?: BoundingBox;
  };
  hint?: string | null;
  solution?: string | null;
  /** Standalone printed answer (subjective / value-based questions). */
  answerValue?: string | null;
  diagram_url?: string | null;
  solution_diagram_url?: string | null;
  passageId?: string | null;
  passageContent?: string | null;
  /**
   * True when stitching could not fully resolve this question (ambiguous
   * path, missing parent, suspicious continuation...). Such questions are
   * still usable, but get sent to the LLM resolver before persistence.
   */
  needsReview?: boolean;
  /** Why the question needs review (stable reason codes + details). */
  reviewReasons?: string[];
}

/**
 * An entity the stitcher could NOT resolve into any question: orphan
 * fragments, unmatched answer rows, unidentified continuations... These are
 * sent to a dedicated LLM resolution call, and whatever it salvages is
 * inserted into the database.
 */
export interface UnresolvedEntity {
  /** Synthetic id (used by the resolver to echo resolution back). */
  id: string;
  fileId: string;
  pageNo: number;
  /** The raw entity as parsed from stage 1. */
  entity: SuperEntity;
  /** Why it could not be resolved (stable reason codes). */
  reasons: string[];
}

export interface StitchResult {
  questions: ResolvedQuestion[];
  /** Entities that require an LLM resolution call. */
  unresolved: UnresolvedEntity[];
  /** Non-fatal diagnostics from stitching (logged, not thrown). */
  warnings: string[];
}

export type { BoundingBox };

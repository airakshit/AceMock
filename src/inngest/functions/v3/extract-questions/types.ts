/**
 * V3 extract-questions types — PATH-BASED resolved questions.
 */
import type { QuestionOption } from "@/features/questions/types";
import type { QuestionFailureReason } from "@/db/schemas/questions/questions";
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
  /** Section-scoped record key of the stitching origin (for rewrite jobs & debugging). */
  recordKey?: string;
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
  /**
   * False when stage 1 reported a figure for this question (stem, solution,
   * or an option) but stage 2 could not localize it. True when every
   * requested figure was resolved — or nothing was requested.
   */
  figureResolved: boolean;
  /**
   * True when stage 2 read the question text/options and explicitly found
   * no diagram matching this entity on the page.
   */
  figureNotFound?: boolean;
  /**
   * All failure codes accumulated for this row — readiness gaps
   * ("missing question", "missing option", "missing solution",
   * "missing answer key") plus figure codes ("figure_not_found",
   * "figure_unresolved"). Persisted into the `not_ready_reason` array column.
   */
  failureReasons?: QuestionFailureReason[];
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
  /**
   * False when any of the question / options / solution / answer key is
   * absent — see `failureReasons`. Ready questions are complete rows.
   */
  isReady: boolean;
}

/**
 * A non-standalone (fragment) question whose text needs an LLM polish pass:
 * the entity's own content plus the parent stem / sibling questions are
 * gathered so the model can write complete, self-contained question and
 * solution text.
 */
export interface StandaloneRewriteJob {
  /** Section-scoped record key — matches ResolvedQuestion.recordKey. */
  id: string;
  pathKey: string;
  fileId: string;
  pageNo: number;
  /** What the entity itself printed — parent stems NOT joined in. */
  ownQuestionText: string;
  ownSolutionText?: string;
  /** Ancestor directive/stem content (top-down), stems only — no figures. */
  parentStem?: string;
  /**
   * `[[FIG:<path>]]` annotation tokens covering this record's and its
   * ancestors' figures. Figures themselves are never sent to the LLM.
   */
  figureAnnotations: string[];
  /** Neighboring complete siblings (document order) for context. */
  surrounding: Array<{
    label: string;
    question: string;
    solution?: string | null;
  }>;
  /** Deterministic merged text the stitcher already computed — the fallback. */
  fallbackQuestion: string;
  fallbackSolution?: string | null;
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
  /** Non-standalone questions queued for the LLM standalone-rewrite pass. */
  standaloneRewrites: StandaloneRewriteJob[];
  /** Non-fatal diagnostics from stitching (logged, not thrown). */
  warnings: string[];
}

export type { BoundingBox };

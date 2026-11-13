/**
 * V3 QUESTION READINESS — a single source of truth for the `is_ready` /
 * `not_ready_reason` columns of the questions table.
 *
 * A question row is READY only when every one of its four constituent parts
 * is present: question text (or a question figure), options (for multiple
 * choice), a solution, and an answer (printed key or worked value).
 * Anything missing is listed in the `not_ready_reason` ARRAY column as
 * machine-readable reason codes, e.g.
 * ["missing solution", "missing answer key"].
 *
 * Reason VALUES are canonical in the questions DB schema
 * (`FAILURE_REASONS` / `failureReasonEnum`); this module splits them into
 * derivation groups and combines them into the persisted
 * `not_ready_reason` array via `buildFailureReasons`.
 */
import type { QuestionFailureReason } from "@/db/schemas/questions/questions";

export const READINESS_REASONS = [
  "missing question",
  "missing option",
  "missing solution",
  "missing answer key",
] as const satisfies readonly QuestionFailureReason[];

export type ReadinessReason = (typeof READINESS_REASONS)[number];

export interface ReadinessInput {
  /** Final question text (stems already joined). */
  question: string | null;
  /** Figures reported for the question stem count as question content. */
  questionFigureCount: number;
  /** True when the question is multiple-choice (options printed or a printed answer key). */
  hasOptions: boolean;
  /** Number of options that actually carry text. */
  optionCount: number;
  /** Final solution text. */
  solution: string | null;
  /** Printed A/B/C/D answer key, when one was actually printed (not defaulted). */
  answerKey: string | null;
  /** Worked/printed answer value (subjective questions), when printed. */
  answerValue: string | null;
}

export interface Readiness {
  isReady: boolean;
  /** Ordered reason codes — the persisted `not_ready_reason` array (plus
   *  mutable bookkeeping for later amendments). */
  reasons: ReadinessReason[];
}

function isMissingText(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

export function deriveReadiness(input: ReadinessInput): Readiness {
  const reasons: ReadinessReason[] = [];

  if (
    isMissingText(input.question) &&
    (input.questionFigureCount ?? 0) === 0
  ) {
    reasons.push("missing question");
  }
  if (input.hasOptions && input.optionCount === 0) {
    reasons.push("missing option");
  }
  if (isMissingText(input.solution)) {
    reasons.push("missing solution");
  }
  if (
    input.answerKey == null &&
    (input.answerValue == null || isMissingText(input.answerValue))
  ) {
    reasons.push("missing answer key");
  }

  return {
    isReady: reasons.length === 0,
    reasons,
  };
}

// ---------------------------------------------------------------------------
// FIGURE resolution failures — a separate axis from readiness. Values are a
// subset of the canonical `FAILURE_REASONS` list owned by the questions DB
// schema (src/db/schemas/questions/questions.ts) — sync asserted by tests.
// ---------------------------------------------------------------------------

export const FIGURE_FAILURE_REASONS = [
  /**
   * Stage 2 read the entity's question/option text and explicitly reported
   * that no diagram on the page matches it.
   */
  "figure_not_found",
  /**
   * Stage 1 requested a figure for some part (stem/solution/option) but
   * stage 2 delivered no bounding boxes for that part.
   */
  "figure_unresolved",
] as const satisfies readonly QuestionFailureReason[];

export type FigureFailureReason = (typeof FIGURE_FAILURE_REASONS)[number];

export interface FigureFailureInput {
  /** False when a requested figure never got bounding boxes. */
  figureResolved: boolean | undefined;
  /** True when stage 2 confidently found no matching diagram. */
  figureNotFound: boolean | undefined;
}

export function deriveFigureFailureReason(
  input: FigureFailureInput,
): FigureFailureReason | null {
  // A confident "no matching diagram" read wins over a merely missing box.
  if (input.figureNotFound === true) return "figure_not_found";
  if (input.figureResolved === false) return "figure_unresolved";
  return null;
}
 
/**
 * The single failure-code list persisted into the questions table's
 * `not_ready_reason` array column: every readiness gap plus (at most one)
 * figure-resolution reason. This is the ONLY place these are combined.
 */
export function buildFailureReasons(
  readinessReasons: readonly ReadinessReason[],
  figureFailureReason: FigureFailureReason | null,
): QuestionFailureReason[] {
  return [
    ...readinessReasons,
    ...(figureFailureReason ? [figureFailureReason] : []),
  ];
}

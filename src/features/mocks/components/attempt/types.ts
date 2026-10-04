/**
 * Shared types for the mock test attempt (exam-taking) UI.
 */

/** Safe subset of the mock test the exam UI is allowed to see. */
export interface MockTestAttemptMeta {
  id: string;
  name: string;
  totalMarks: number;
  totalQuestions: number;
  durationSeconds: number;
  /** Attempts a student may take; 0 = unlimited. */
  maxAttempts: number;
  /** True when the attempt runs without a countdown or auto-submit. */
  allowUntimed: boolean;
  negativePercentagePerQuestion: number;
}

export type OptionKey = "A" | "B" | "C" | "D";

/**
 * Lifecycle of the attempt screen.
 * - instructions: confirmation dialog with auto-generated rules
 * - starting: attempt creation in flight
 * - exam: the live test
 * - finishing: submit (complete) request in flight
 * - finished: submission done, summary screen
 */
export type AttemptPhase =
  | "instructions"
  | "starting"
  | "exam"
  | "finishing"
  | "finished";

/** Why the attempt was finished — drives the summary copy. */
export type FinishReason = "manual" | "time-up";

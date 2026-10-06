// Display-layer types for the QuestionCard component.
// These are separate from the DB-layer QuestionDTO in ../types.ts.
// The parent is responsible for mapping from QuestionDTO → QuestionCardType.
import type { questionReportTypeEnum } from "@/db/schemas";

export type QuestionSubject =
  | "physics"
  | "chemistry"
  | "mathematics"
  | "english"
  | "general"
  | (string & {});
export type QuestionMode = "exam" | "review";
export type OptionKey = "A" | "B" | "C" | "D";
export type QuestionDifficultyLevel = "easy" | "medium" | "hard";

export type OptionType = {
  /** Always one of A | B | C | D — explicit key, not index-derived */
  key: OptionKey;
  /** Raw OCR / markdown text. LaTeX via $...$ or $$...$$ or \ce{} */
  content: string;
  /** Only inspected in review mode. Never leaked in exam mode. */
  isCorrect?: boolean;
};

export type PassageType = {
  id: string;
  content: string;
  /** Question positions (1-based) in the test that belong to this passage. */
  questionPositions: number[];
};

export type QuestionCardType = {
  id: string;
  subject: QuestionSubject;
  /** Optional difficulty chip shown in the card header */
  difficulty?: QuestionDifficultyLevel;
  /** Raw OCR / markdown text with embedded LaTeX */
  questionText: string;
  /** Always 4 options (A B C D) for MCQ */
  options: OptionType[];
  /**
   * Authoritative correct answer key. Optional because some consumers
   * (e.g. the bookmarks page) only receive it after an explicit
   * "View solution" request — until then the card renders exam-style
   * and never reveals an answer.
   */
  correctOption?: OptionKey;
  /** Shown only in review mode */
  explanation?: string;
  marks?: number;
  negativeMarks?: number;
  /** Signed URL for the question figure (from diagram_url column) */
  diagramUrl?: string | null;
  /** Signed URL for solution working image (from solution_diagram_url column) */
  solutionDiagramUrl?: string | null;
  /** Optional reading passage linked to this question. */
  passage?: PassageType | null;
};

export type QuestionCardProps = {
  question: QuestionCardType;
  questionNumber?: number;
  mode: QuestionMode;
  /** Parent owns selected-answer state — fully controlled */
  selectedAnswer: OptionKey | null;
  /** Optimistic selection (exam mode) — shown immediately before server confirmation */
  pendingAnswer?: OptionKey | null;
  onAnswerChange: (key: OptionKey) => void;
  /** Extra classes merged onto the card root (e.g. shadow overrides). */
  className?: string;
  /**
   * Whether the question is already bookmarked. Controls the bookmark
   * button's initial visual state (amber, filled icon) and acts as a
   * frontend guard so no create request is sent when it is already
   * bookmarked. The bookmarks page passes `true`.
   */
  isBookmarked?: boolean;
  /**
   * Bookmarks-page-only solution controls. When omitted — as in mock
   * tests — no solution buttons are ever rendered and no solution data
   * reaches the card.
   *
   * - `isLoaded`: solution data is in memory (fetched on demand, or
   *   loaded with the page when it was requested with
   *   `includeSolution: true`).
   * - `isVisible`: the loaded solution is currently revealed (grading +
   *   explanation panel). Hiding keeps `isLoaded` true, so re-showing
   *   never issues another request.
   * - `isLoading`: a solution fetch is in flight.
   * - `onView` / `onHide` / `onShow`: footer button callbacks.
   */
  solutionControls?: {
    isLoaded: boolean;
    isVisible: boolean;
    isLoading: boolean;
    onView: () => void;
    onHide: () => void;
    onShow: () => void;
  };
};

/**
 * Report category for a question.
 * Derived from the `question_report_type_enum` Postgres enum so the
 * server, service layer, and UI always agree on the valid values.
 */
export type QuestionReportType =
  (typeof questionReportTypeEnum.enumValues)[number];

/**
 * Display metadata for a single report category — a human readable
 * label plus the description shown beneath it in the report menu.
 */
export interface QuestionReportOption {
  value: QuestionReportType;
  label: string;
  description: string;
}

/**
 * Every report option (with its description) for the UI, keyed by the
 * `question_report_type_enum` values. Declared as `Record` so that adding
 * a new enum value without a matching entry fails type-checking.
 */
const QUESTION_REPORT_OPTION_META = {
  invalid_question: {
    label: "Invalid question",
    description: "The question text is wrong, unclear, or doesn't make sense.",
  },
  invalid_options: {
    label: "Invalid options",
    description:
      "An answer choice is duplicated, missing, or clearly not valid.",
  },
  invalid_solution: {
    label: "Invalid solution",
    description: "The provided solution or explanation is incorrect.",
  },
  incomplete_solution: {
    label: "Incomplete solution",
    description: "The solution is correct but missing steps or reasoning.",
  },
  rendering_error: {
    label: "Rendering error",
    description: "Text, LaTeX, images, or diagrams don't display properly.",
  },
  other: {
    label: "Other",
    description: "Something else that isn't covered by the options above.",
  },
} as const satisfies Record<
  QuestionReportType,
  { label: string; description: string }
>;

/** Report options in menu order, ready for display. */
export const QUESTION_REPORT_OPTIONS: readonly QuestionReportOption[] =
  Object.entries(QUESTION_REPORT_OPTION_META).map(([value, meta]) => ({
    value: value as QuestionReportType,
    ...meta,
  }));

/** Runtime guard for untrusted server-action input. */
export function isQuestionReportType(
  value: unknown,
): value is QuestionReportType {
  return (
    typeof value === "string" &&
    QUESTION_REPORT_OPTIONS.some((option) => option.value === value)
  );
}

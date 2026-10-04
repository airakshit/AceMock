import type { questionReportTypeEnum } from "@/db/schemas";

export type QuestionDifficulty = "easy" | "medium" | "hard";

export type QuestionOptionKey = "A" | "B" | "C" | "D";

export interface QuestionOption {
  key: QuestionOptionKey;
  text: string;
}

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
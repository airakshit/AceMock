// Display-layer types for the QuestionCard component.
// These are separate from the DB-layer QuestionDTO in ../types.ts.
// The parent is responsible for mapping from QuestionDTO → QuestionCardType.

export type QuestionSubject = "physics" | "chemistry" | "mathematics" | "english" | "general" | (string & {});
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
};

export type QuestionCardProps = {
  question: QuestionCardType;
  questionNumber?: number;
  mode: QuestionMode;
  /** Parent owns selected-answer state — fully controlled */
  selectedAnswer: OptionKey | null;
  onAnswerChange: (key: OptionKey) => void;
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

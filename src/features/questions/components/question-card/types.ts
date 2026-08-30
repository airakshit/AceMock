// Display-layer types for the QuestionCard component.
// These are separate from the DB-layer QuestionDTO in ../types.ts.
// The parent is responsible for mapping from QuestionDTO → QuestionCardType.

export type QuestionSubject = "physics" | "chemistry" | "mathematics";
export type QuestionMode = "exam" | "review";
export type OptionKey = "A" | "B" | "C" | "D";

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
  /** Raw OCR / markdown text with embedded LaTeX */
  questionText: string;
  /** Always 4 options (A B C D) for MCQ */
  options: OptionType[];
  /** Authoritative correct answer key */
  correctOption: OptionKey;
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
};

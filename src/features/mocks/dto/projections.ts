// Read models returned by repositories for queries
// Accessed by: repositories and services

export interface MockTestListItemProjection {
  id: string;
  name: string;
  totalMarks: number;
  negativePercentagePerQuestion: number;
  durationSeconds: number;
  instructions: string | null;
  questionCount: number;
  createdAt: Date;
  updatedAt: Date;
  creatorName?: string | null;
  creatorEmail?: string | null;
}

export interface MockTestQuestionItemProjection {
  id: string;
  questionId: string;
  position: number;
  question: string;
  marks: number;
  difficulty: "easy" | "medium" | "hard";
  options: Array<{
    key: string;
    text: string;
  }>;
  correctOption: string;
  hint?: string | null;
  solution?: string | null;
  questionDiagram?: string | null;
  solutionDiagram?: string | null;
  documentTitle?: string | null;
}

export interface MockTestDetailsProjection extends MockTestListItemProjection {
  questions: MockTestQuestionItemProjection[];
}

export interface DocumentOptionForMockProjection {
  id: string;
  title: string;
  createdAt: Date;
  questionCount: number;
}

/**
 * Read model for mock test attempt questions with passages.
 * Questions are grouped by passage for efficient UI rendering.
 */
export interface MockTestAttemptQuestionsProjection {
  questions: MockAttemptQuestionProjection[];
  passages: MockAttemptPassageProjection[];
}

export interface MockAttemptQuestionProjection {
  id: string; // mock_tests_questions.id (the link record)
  questionId: string; // questions.id
  position: number;
  question: string;
  marks: number;
  difficulty: "easy" | "medium" | "hard";
  options: Array<{
    key: string;
    text: string;
  }>;
  questionDiagram?: string | null;
  passageId?: string | null;
  passagePosition?: number | null; // Position within the passage group
  /** Solution/explanation text. */
  solution?: string | null;
  /** Solution diagram storage path or URL. */
  solutionDiagram?: string | null;
}

export interface MockAttemptPassageProjection {
  id: string;
  content: string;
  questionIds: string[]; // questions.id that belong to this passage
}

/**
 * Read model for a mock test attempt with its metadata
 */
export interface MockTestAttemptProjection {
  id: string;
  mockTestId: string;
  userId: string;
  status: "in_progress" | "completed";
  submittedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Read model for a single attempt answer
 */
export interface MockAttemptAnswerProjection {
  id: string;
  attemptId: string;
  questionId: string;
  selectedOption: "A" | "B" | "C" | "D";
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Attempt history (My History feature)
// ---------------------------------------------------------------------------

/** Raw attempt row joined with its mock test configuration. */
export interface AttemptMetaProjection {
  id: string;
  mockTestId: string;
  mockTestName: string;
  status: "in_progress" | "completed";
  startedAt: Date;
  submittedAt: Date | null;
  durationSeconds: number;
  totalMarks: number;
  negativePercentagePerQuestion: number;
}

/** Answer row used while scoring an attempt. */
export interface AttemptAnswerRowProjection {
  attemptId: string;
  questionId: string;
  selectedOption: string;
}

/** Question row used while scoring/reviewing an attempt. */
export interface AttemptQuestionRowProjection {
  mockTestId: string;
  questionId: string;
  position: number;
  question: string;
  options: Array<{ key: string; text: string }>;
  marks: number;
  correctOption: string;
}

/** Aggregated, scored summary of one attempt. */
export interface AttemptHistoryItemProjection {
  id: string;
  mockTestId: string;
  mockTestName: string;
  status: "in_progress" | "completed";
  startedAt: Date;
  submittedAt: Date | null;
  durationSeconds: number;
  totalMarks: number;
  negativePercentagePerQuestion: number;
  totalQuestions: number;
  attemptedCount: number;
  unattemptedCount: number;
  correctCount: number;
  incorrectCount: number;
  /** Earned marks: +marks per correct, −marks×penalty% per wrong. */
  scoreMarks: number;
  /** correct ÷ attempted, in percent (0 when nothing was attempted). */
  accuracyPercent: number;
}

/** Per-question review of a completed attempt. */
export interface AttemptDetailQuestionProjection {
  position: number;
  questionId: string;
  question: string;
  options: Array<{ key: string; text: string }>;
  selectedOption: string | null;
  correctOption: string;
  isCorrect: boolean;
  marks: number;
  marksAwarded: number;
}

/**
 * Single question with full review data (correct answer, user answer, marks).
 * Maps to the prebuilt QuestionCard's expected interface.
 */
export interface ReviewQuestionResult extends MockAttemptQuestionProjection {
  /** Passage this question belongs to, with sibling question IDs. */
  passage: MockAttemptPassageProjection | null;
  /** Option the user selected (or null if skipped). */
  selectedOption: string | null;
  /** The correct option key. */
  correctOption: string;
  /** Whether the user's answer was correct. */
  isCorrect: boolean;
  /** Marks awarded (positive for correct, negative for wrong, 0 for unattempted). */
  marksAwarded: number;
  /** Subject for the question (defaults to "General"). */
  subject?: string;
  /** Negative marks for wrong answer (from test config). */
  negativeMarks?: number;
}

/** Index item in the review summary: minimal question status. */
export interface AttemptReviewIndexItem {
  questionId: string;
  position: number;
  status: "correct" | "incorrect" | "unattempted";
}

/** Full breakdown of a single completed attempt. */
export interface AttemptDetailsProjection {
  attempt: AttemptHistoryItemProjection;
  questions: AttemptDetailQuestionProjection[];
}

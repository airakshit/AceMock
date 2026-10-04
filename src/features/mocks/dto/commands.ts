// Database write models consumed by repository insert/update operations
// Accessed by: services and repositories

export interface CreateMockTestCommand {
  id: string;
  userId: string;
  name: string;
  totalMarks: number;
  negativePercentagePerQuestion: number;
  durationSeconds: number;
  instructions?: string | null;
}

export interface CreateMockTestQuestionItemCommand {
  id: string;
  mockTestId: string;
  questionId: string;
  position: number;
}

export interface DeleteMockTestCommand {
  id: string;
}

export interface CreateMockAttemptCommand {
  id: string;
  userId: string;
  mockTestId: string;
}

export interface SubmitAttemptAnswerCommand {
  id: string;
  attemptId: string;
  questionId: string;
  selectedOption: "A" | "B" | "C" | "D";
}

export interface CompleteMockAttemptCommand {
  attemptId: string;
}

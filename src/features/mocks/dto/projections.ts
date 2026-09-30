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

export type QuestionDifficulty = "easy" | "medium" | "hard";

export type QuestionOptionKey = "A" | "B" | "C" | "D";

export interface QuestionOption {
  key: QuestionOptionKey;
  text: string;
}

export interface QuestionFileItem {
  clientFileId: string;
  file: File;
}

export interface QuestionDTO {
  id: string;
  question: string;
  chapterId: string;
  passageId: string | null;
  fileId: string | null;
  options: QuestionOption[];
  correctOption: string;
  marks: number;
  difficulty: QuestionDifficulty;
  diagram_url: string | null;
  hint: string | null;
  solution: string | null;
  solution_diagram_url: string | null;
  createdAt: Date;
  updatedAt: Date;
}

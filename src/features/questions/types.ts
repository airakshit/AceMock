export type QuestionDifficulty = "easy" | "medium" | "hard";

export type QuestionOptionKey = "A" | "B" | "C" | "D";

export interface QuestionOption {
  key: QuestionOptionKey;
  text: string;
}

import { z } from "zod";
import type { ResolvedQuestion } from "../extract-questions/types";

/**
 * Subjects exactly as tagged by the OCR extraction schema
 * (`ocr-page/structured-question-schema.ts`).
 */
export const OcrSubjectSchema = z.enum([
  "physics",
  "chemistry",
  "maths",
  "grammar",
  "comprehension",
]);

export type OcrSubject = z.infer<typeof OcrSubjectSchema>;

/**
 * The minimum shape needed to classify a question. Everything else the
 * extraction pipeline produces (solutions, marks, diagrams, passages) is
 * irrelevant to choosing a section and chapter, so it is dropped here to keep
 * the classification prompt small and cheap.
 */
export const classifiableQuestionSchema = z.object({
  /** The question text, cleaned of serial-number prefixes by the merge step. */
  question: z.string().min(1),

  /** Already classified upstream by the OCR pass. */
  subject: OcrSubjectSchema,

  /** Answer choices, used only as supporting context for the classifier. */
  options: z.array(
    z.object({
      key: z.enum(["A", "B", "C", "D"]),
      text: z.string().min(1),
    }),
  ),
});

export type ClassifiableQuestion = z.infer<typeof classifiableQuestionSchema>;

/** Aliases tolerated when normalising an OCR subject tag onto the curriculum. */
const SUBJECT_ALIASES: Record<string, OcrSubject> = {
  physics: "physics",
  chemistry: "chemistry",
  maths: "maths",
  mathematics: "maths",
  grammar: "grammar",
  comprehension: "comprehension",
};

/**
 * Normalises the free-form subject string coming out of the OCR merge into a
 * known subject. Returns `null` when the tag cannot be mapped — such questions
 * are skipped rather than guessed at.
 */
export function normalizeOcrSubject(value: string | undefined | null): OcrSubject | null {
  if (!value) return null;
  return SUBJECT_ALIASES[value.toLowerCase().trim()] ?? null;
}

/**
 * Projects a fully merged OCR question down to the classification input.
 * Returns `null` when there is no usable question text or no known subject.
 */
export function toClassifiableQuestion(
  resolved: ResolvedQuestion,
): ClassifiableQuestion | null {
  const subject = normalizeOcrSubject(resolved.subject);
  if (!subject) return null;

  const question = resolved.question?.trim();
  if (!question) return null;

  const options = resolved.options
    .filter((option) => option.text && option.text.trim().length > 0)
    .map((option) => ({
      key: option.key,
      text: option.text.trim(),
    }));

  return classifiableQuestionSchema.parse({ question, subject, options });
}

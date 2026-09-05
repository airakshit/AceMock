import { z } from "zod";

const optionKeySchema = z.enum(["A", "B", "C", "D"]);

const subjectSchema = z.enum([
  "physics",
  "chemistry",
  "maths",
  "grammar",
  "comprehension",
]);

const questionDataSchema = z
  .object({
    // Primary identifier — required for every data item
    serialNo: z.number().int().positive(),

    // Question content
    question: z.string().optional(),

    // Options are only present when the question has options
    options: z
      .object({
        A: z.string().optional(),
        B: z.string().optional(),
        C: z.string().optional(),
        D: z.string().optional(),
      })
      .strict()
      .optional(),

    // Answer key — only A/B/C/D
    answerKey: z
      .string()
      .transform((value) =>
        value
          .toUpperCase()
          .replace(".", "")
          .replace("(", "")
          .replace(")", "")
          .trim(),
      )
      .pipe(optionKeySchema)
      .optional(),

    // Required according to your prompt
    subject: subjectSchema,

    marks: z.coerce.number().optional(),

    // Step-by-step solution
    solution: z.string().optional(),

    // Page/question continuation metadata
    optionIncomplete: z.boolean().optional(),
    incomplete: z.boolean().optional(),
    isContinuation: z.boolean().optional(),

    svgQuestion: z.string().optional(),
    svgSolution: z.string().optional(),
    svgOptions: z
      .object({
        A: z.string().optional(),
        B: z.string().optional(),
        C: z.string().optional(),
        D: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const structuredOCRExtractionSchema = z
  .object({
    isRelevant: z.boolean().optional(),

    sectionLabel: z.string().optional(),

    sectionStart: z.number().int().positive().optional(),

    sectionEnd: z.number().int().positive().optional(),

    eachMarks: z.number().optional(),

    paragraph: z.string().optional(),

    data: z.array(questionDataSchema),
  })
  .strict();

export type StructuredSchemaParseResult = z.infer<
  typeof structuredOCRExtractionSchema
>;

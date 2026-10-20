import { z } from "zod";

// Should allow small a,b,c,d too so that it parses.
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
    serialNo: z.coerce
      .number()
      .describe("Primary identifier for every question or solution."),

    // Question content
    question: z.string().optional().describe("The actual question text."),

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
    subject: z
      .string()
      .transform((value) => value.toLowerCase().trim())
      .pipe(subjectSchema)
      .optional(),

    marks: z.coerce.number().optional(),

    // Step-by-step solution
    solution: z.string().optional(),

    // Figure flag — the LLM must NOT draw figures; it only reports that one exists.
    hasFigure: z
      .boolean()
      .optional()
      .describe(
        "Set true when this question, its solution, or any of its options contains a diagram/figure/graph that needs to be extracted separately.",
      ),

    // Page/question continuation metadata
    optionIncomplete: z.boolean().optional(),
    incomplete: z.boolean().optional(),
    isContinuation: z.boolean().optional(),

    /**
     * NOTE: these are kept for backwards compatibility only. Pages OCR'd before
     * figures were split into their own extraction stage stored inline SVG in
     * `raw_text`, and `mergeOcrResults` still reads them so those documents keep
     * their figures. The extraction prompt no longer asks for them.
     */
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

    sectionStart: z.coerce.number().optional(),

    sectionEnd: z.coerce.number().optional(),

    eachMarks: z.coerce.number().optional(),

    paragraph: z.string().optional(),

    data: z
      .array(questionDataSchema)
      .nullish()
      .transform((val) => val ?? []),
  })
  .strict();

export type StructuredSchemaParseResult = z.infer<
  typeof structuredOCRExtractionSchema
>;
import { StructuredJsonOptions } from "@/services/llm/base";

export const structuredOCRJsonSchema: StructuredJsonOptions = {
  name: "structured_ocr_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      isRelevant: {
        type: ["boolean", "null"],
      },
      sectionLabel: {
        type: ["string", "null"],
      },
      sectionStart: {
        type: ["number", "null"],
      },
      sectionEnd: {
        type: ["number", "null"],
      },
      eachMarks: {
        type: ["number", "null"],
      },
      paragraph: {
        type: ["string", "null"],
      },
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            serialNo: { type: "number" },
            question: { type: ["string", "null"] },
            options: {
              type: ["object", "null"],
              properties: {
                A: { type: ["string", "null"] },
                B: { type: ["string", "null"] },
                C: { type: ["string", "null"] },
                D: { type: ["string", "null"] },
              },
              additionalProperties: false,
            },
            answerKey: {
              type: ["string", "null"],
              enum: ["A", "B", "C", "D", null],
            },
            subject: {
              type: ["string", "null"],
              enum: [
                "physics",
                "chemistry",
                "maths",
                "grammar",
                "comprehension",
                null,
              ],
            },
            marks: { type: ["number", "null"] },
            solution: { type: ["string", "null"] },

            // Figures are flagged, never drawn — they are extracted in a
            // separate stage so the SVG does not compete for output tokens.
            hasFigure: { type: ["boolean", "null"] },

            optionIncomplete: { type: ["boolean", "null"] },
            incomplete: { type: ["boolean", "null"] },
            isContinuation: { type: ["boolean", "null"] },
          },
          required: ["serialNo"],
          anyOf: [
            { required: ["question"] },
            { required: ["options"] },
            { required: ["answerKey"] },
            { required: ["solution"] },
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["isRelevant", "data"],
    additionalProperties: false,
  },
};

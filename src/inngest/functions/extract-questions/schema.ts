import { z } from "zod";

const optionKeySchema = z.enum(["A", "B", "C", "D"]);

const subjectSchema = z.enum([
  "physics",
  "chemistry",
  "maths",
  "grammar",
  "comprehension"
]);

const questionDataSchema = z
  .object({
    // Primary identifier — required for every data item
    serialNo: z.coerce.number().describe("Primary identifier for every question or solution."),

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

    sectionStart: z.coerce.number().optional(),

    sectionEnd: z.coerce.number().optional(),

    eachMarks: z.coerce.number().optional(),

    paragraph: z.string().optional(),

    data: z.array(questionDataSchema).nullish().transform((val) => val ?? []),
  })
  .strict();

export type StructuredSchemaParseResult = z.infer<
  typeof structuredOCRExtractionSchema
>;

import type { StructuredJsonOptions } from "@/services/llm";

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
        description: "ROOT ONLY: Comprehension passage text. NEVER place inside a data[] item.",
      },
      data: {
        type: "array",
        description: "Questions/solutions/answer-keys list. NEVER embed paragraph or section fields inside items.",
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
              enum: ["physics", "chemistry", "maths", "grammar", "comprehension", null],
            },
            marks: { type: ["number", "null"] },
            solution: { type: ["string", "null"] },
            optionIncomplete: { type: ["boolean", "null"] },
            incomplete: { type: ["boolean", "null"] },
            isContinuation: { type: ["boolean", "null"] },
            svgQuestion: { type: ["string", "null"] },
            svgSolution: { type: ["string", "null"] },
            svgOptions: {
              type: ["object", "null"],
              properties: {
                A: { type: ["string", "null"] },
                B: { type: ["string", "null"] },
                C: { type: ["string", "null"] },
                D: { type: ["string", "null"] },
              },
              additionalProperties: false,
            },
          },
          required: [
            "serialNo",
          ],
          anyOf: [
            { "required": ["question"] },
            { "required": ["options"] },
            { "required": ["answerKey"] },
            { "required": ["solution"] },
            { "required": ["svgQuestion"] },
            { "required": ["svgSolution"] },
            { "required": ["svgOptions"] }
          ],
          additionalProperties: false,
        },
      },
    },
    required: [
      "isRelevant",
      "data"
    ],
    additionalProperties: false,
  },
};

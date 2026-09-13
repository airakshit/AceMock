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
        description:
          "False if page is blank, contains only instructions/headers, or has no exam entities.",
      },
      sectionLabel: {
        type: ["string", "null"],
        description:
          "PAGE-LEVEL (Root only): Section name/header if explicitly printed (e.g. 'SECTION A - PHYSICS').",
      },
      sectionStart: {
        type: ["number", "null"],
        description: "PAGE-LEVEL (Root only): Starting question number of the section if indicated.",
      },
      sectionEnd: {
        type: ["number", "null"],
        description: "PAGE-LEVEL (Root only): Ending question number of the section if indicated.",
      },
      eachMarks: {
        type: ["number", "null"],
        description: "PAGE-LEVEL (Root only): Default marks per question in this section (e.g. 1).",
      },
      paragraph: {
        type: ["string", "null"],
        description:
          "PAGE-LEVEL (Root only): Full text of comprehension reading passage if present on page. Must be at root, never inside data items.",
      },
      data: {
        type: "array",
        description:
          "PAGE-LEVEL (Root only): List of extracted questions, solutions, or answer keys. Never put paragraph or section metadata inside items here.",
        items: {
          type: "object",
          description:
            "ITEM-LEVEL: A single question, solution, or answer key item.",
          properties: {
            serialNo: {
              type: "number",
              description:
                "Primary identifier/number for the question or solution.",
            },
            question: {
              type: ["string", "null"],
              description:
                "The actual question text formatted with LaTeX/mhchem where applicable.",
            },
            options: {
              type: ["object", "null"],
              description: "Four choices A, B, C, D if present.",
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
              description: "Correct answer key option label (A, B, C, or D).",
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
              description: "Subject classification.",
            },
            marks: {
              type: ["number", "null"],
              description: "Marks for this question.",
            },
            solution: {
              type: ["string", "null"],
              description: "Step-by-step solution text if present on page.",
            },
            optionIncomplete: {
              type: ["boolean", "null"],
              description:
                "True if options are cut off or fewer than 4 choices appear.",
            },
            incomplete: {
              type: ["boolean", "null"],
              description:
                "True if question or solution is cut off at the page bottom.",
            },
            isContinuation: {
              type: ["boolean", "null"],
              description: "True if content continues from previous page top without any serial number.",
            },
            svgQuestion: {
              type: ["string", "null"],
              description:
                "Inline SVG representation of question diagram if present.",
            },
            svgSolution: {
              type: ["string", "null"],
              description:
                "Inline SVG representation of solution diagram if present.",
            },
            svgOptions: {
              type: ["object", "null"],
              description: "SVG diagrams for individual options if present.",
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


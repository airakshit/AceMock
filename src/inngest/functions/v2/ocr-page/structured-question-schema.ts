import { z } from "zod";

import { StructuredJsonOptions } from "@/services/llm/base";

// Should allow small a,b,c,d too so that it parses.
const optionKeySchema = z.enum(["A", "B", "C", "D"]);

const subjectSchema = z.enum([
  "physics",
  "chemistry",
  "maths",
  "grammar",
  "comprehension",
]);

/** Single coordinate: coerced and clamped into the normalized [0, 1] range. */
const bboxCoordSchema = z.coerce
  .number()
  .describe(
    "Normalized coordinate on the full page image, in the 0.0-1.0 range (origin at the top-left corner).",
  );

/**
 * A figure location reported by the OCR model.
 *
 * Coordinates are normalized fractions of the full page width/height
 * (origin top-left), not pixels, so they survive image resizing. A single
 * figure always gets its own box — figures are never merged, even when two
 * drawings sit close together on the page.
 */
const boundingBoxSchema = z
  .object({
    /** Top edge of the box, measured from the top of the page (0-1). */
    yMin: bboxCoordSchema,
    /** Left edge of the box, measured from the left of the page (0-1). */
    xMin: bboxCoordSchema,
    /** Bottom edge of the box, measured from the top of the page (0-1). */
    yMax: bboxCoordSchema,
    /** Right edge of the box, measured from the left of the page (0-1). */
    xMax: bboxCoordSchema,
  })
  .strict()
  .transform(({ xMin, yMin, xMax, yMax }) => ({
    // Models occasionally swap min/max when the page is read upside
    // down; normalize the orientation instead of failing validation.
    xMin: Math.min(xMin, xMax),
    yMin: Math.min(yMin, yMax),
    xMax: Math.max(xMin, xMax),
    yMax: Math.max(yMin, yMax),
  }));

export type BoundingBox = z.infer<typeof boundingBoxSchema>;

// One per each of A, B, C, D, all optional: an option has either text, its
// own diagram (or both), or nothing.
const optionFiguresSchema = z
  .object({
    A: boundingBoxSchema.nullish(),
    B: boundingBoxSchema.nullish(),
    C: boundingBoxSchema.nullish(),
    D: boundingBoxSchema.nullish(),
  })
  .strict();

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

    subject: z
      .string()
      .transform((value) => value.toLowerCase().trim())
      .pipe(subjectSchema)
      .optional(),

    marks: z.coerce.number().optional(),

    solution: z.string().optional(),

    /**
     * Figure locations — replaces the former `hasFigure` boolean.
     *
     * A diagram that appears in the question stem, in the solution, or next
     * to an option is reported as a tight bounding box so a separate
     * object-detection/cropping stage can cut each figure as its own image
     * (stem diagram, solution diagram, and per-option diagrams are all
     * independent). Presence of a box implies the figure exists.
     */
    questionFigures: z
      .array(boundingBoxSchema)
      .optional()
      .describe(
        "Bounding boxes of each separate diagram belonging to the question stem, in reading order.",
      ),
    solutionFigures: z
      .array(boundingBoxSchema)
      .optional()
      .describe(
        "Bounding boxes of each separate diagram belonging to the solution.",
      ),
    optionFigures: optionFiguresSchema
      .optional()
      .describe(
        "Per-option diagram bounding boxes. Each keyed option (A-D) with its own diagram gets its own independent box.",
      ),

    // Page/question continuation metadata
    optionIncomplete: z.boolean().optional(),
    incomplete: z.boolean().optional(),
    isContinuation: z.boolean().optional(),
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

/**
 * One figure bounding box in the strict-JSON-schema flavor: every field is
 * nullable, and all four coordinates are always required together.
 */
const boundingBoxJsonSchema = {
  type: ["object", "null"],
  properties: {
    yMin: {
      type: ["number", "null"],
      description:
        "Top edge of the figure's box, normalized 0-1 measured from the top of the page image.",
    },
    xMin: {
      type: ["number", "null"],
      description:
        "Left edge of the figure's box, normalized 0-1 measured from the left of the page image.",
    },
    yMax: {
      type: ["number", "null"],
      description:
        "Bottom edge of the figure's box, normalized 0-1 measured from the top of the page image.",
    },
    xMax: {
      type: ["number", "null"],
      description:
        "Right edge of the figure's box, normalized 0-1 measured from the left of the page image.",
    },
  },
  required: ["yMin", "xMin", "yMax", "xMax"],
  additionalProperties: false,
} as const;

const optionFiguresJsonSchema = {
  type: ["object", "null"],
  properties: {
    A: boundingBoxJsonSchema,
    B: boundingBoxJsonSchema,
    C: boundingBoxJsonSchema,
    D: boundingBoxJsonSchema,
  },
  additionalProperties: false,
} as const;

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

            // Figure locations (object detection). Each diagram is reported
            // as its own bounding box — stem, solution, and per-option
            // diagrams are independent. A box present means a figure exists;
            // no box means none.
            questionFigures: {
              type: ["array", "null"],
              description:
                "Bounding boxes of each separate diagram in the question stem.",
              items: boundingBoxJsonSchema,
            },
            solutionFigures: {
              type: ["array", "null"],
              description:
                "Bounding boxes of each separate diagram in the solution.",
              items: boundingBoxJsonSchema,
            },
            optionFigures: {
              description:
                "Independent bounding box per option key (A-D) whose option has its own diagram.",
              ...optionFiguresJsonSchema,
            },

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
            { required: ["questionFigures"] },
            { required: ["solutionFigures"] },
            { required: ["optionFigures"] },
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["isRelevant", "data"],
    additionalProperties: false,
  },
};

import { z } from "zod";

import { StructuredJsonOptions } from "@/services/llm/base";

const optionKeySchema = z.enum(["A", "B", "C", "D"]);

/**
 * Removes: Symbols from options like: '.', '()' and converts to uppercase.
 */
const optionsSchemaPreprocessCb = (value: unknown) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }

  const normalized: Record<string, unknown> = { ...value };

  for (const key of Object.keys(normalized)) {
    const cleanedKey = key
      .trim()
      .replace(/^\(?([a-d])\)?\.?$/i, (_, letter: string) =>
        letter.toUpperCase(),
      );

    if (cleanedKey !== key) {
      normalized[cleanedKey] ??= normalized[key];
      delete normalized[key];
    }
  }
  return normalized;
};

const subjectSchema = z.enum([
  "physics",
  "chemistry",
  "maths",
  "grammar",
  "comprehension",
]);

/**
 * Single coordinate: coerced; values arrive as native 0-1000 grounding
 * integers and are rescaled to 0-1 fractions by the parse pipeline
 * (normalizeStructuredOCR) before they reach this schema.
 */
const bboxCoordSchema = z.coerce
  .number()
  .describe(
    "Bounding-box coordinate on the 0-1000 integer grounding scale of the full page image (origin top-left); normalized to a 0-1 fraction downstream.",
  );

/**
 * A figure location reported by the OCR model.
 *
 * The model reports boxes in Gemini's native 0-1000 integer grounding
 * convention; the parse pipeline divides by 1000, so everything downstream
 * (stored bboxes, crops, merges) works in normalized 0-1 fractions with the
 * origin top-left. A single figure always gets its own box — figures are
 * never merged, even when two drawings sit close together on the page.
 */
const boundingBoxSchema = z
  .object({
    yMin: bboxCoordSchema,
    xMin: bboxCoordSchema,
    yMax: bboxCoordSchema,
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

/**
 * Question/Solution content: text required, figures optional.
 * The provider schema forces `text` to a (possibly empty) string and
 * `figures` to an array (empty when there are none), so no nulls reach here.
 */
const textAndFiguresSchema = z
  .object({
    text: z
      // Defensive: non-strict providers occasionally omit/null the text of a
      // figure-only block; coerce to "" instead of failing validation.
      .preprocess((value) => (value == null ? "" : value), z.string())
      .describe(
        "The question or solution text content. Required for question and solution fields.",
      ),
    figures: z
      .array(boundingBoxSchema)
      .optional()
      .describe(
        "Bounding boxes of each separate diagram belonging to this question or solution, in reading order.",
      ),
  })
  .strict();

export type TextAndFigures = z.infer<typeof textAndFiguresSchema>;

/**
 * Option content: text and figure are both optional, but an option that is
 * present must have at least one of them (an object where BOTH are absent is
 * treated as "this option does not exist on the page" and is tolerated).
 * figure is a single bounding box (not an array) — each option has at most one figure.
 */
const optionContentSchema = z
  .object({
    text: z.string().optional().describe("The option text content."),
    figure: boundingBoxSchema
      .optional()
      .describe(
        "Bounding box of the single diagram belonging to this option. At most one figure per option.",
      ),
  })
  .strict();

export type OptionContent = z.infer<typeof optionContentSchema>;

const questionDataSchema = z
  .object({
    // Primary identifier — required for every data item
    serialNo: z.coerce
      .number()
      .describe("Primary identifier for every question or solution."),

    // Question text and its associated figures.
    question: textAndFiguresSchema.optional(),

    // Each option keeps its text and optional single figure together — all
    // keys optional so a page with only two visible options is still valid.
    options: z
      .preprocess(
        optionsSchemaPreprocessCb,
        z
          .object({
            A: optionContentSchema.optional(),
            B: optionContentSchema.optional(),
            C: optionContentSchema.optional(),
            D: optionContentSchema.optional(),
          })
          .strict()
          .optional(),
      ),

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

    solution: textAndFiguresSchema.optional(),

    // Page/question continuation metadata
    isContinuation: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.question !== undefined ||
      data.options !== undefined ||
      data.answerKey !== undefined ||
      data.solution !== undefined,
    "Each question data item must have at least one of: question, options, answerKey, or solution.",
  )
  .strict();

export type QuestionData = z.infer<typeof questionDataSchema>;

export const structuredOCRExtractionSchema = z
  .object({
    isRelevant: z.boolean().optional(),

    sectionLabel: z.string().optional(),

    sectionStart: z.coerce.number().optional(),

    sectionEnd: z.coerce.number().optional(),

    eachMarks: z.coerce.number().optional(),

    englishParagraph: z.string().optional(),

    data: z
      .array(questionDataSchema)
      .nullish()
      .transform((val) => val ?? []),
  })
  .strict();

export type StructuredSchemaParseResult = z.infer<
  typeof structuredOCRExtractionSchema
>;

// ---------------------------------------------------------------------------
// JSON Schema for API-enforced structured output (`response_format`)
// ---------------------------------------------------------------------------
//
// DESIGN NOTE (do not casually change):
// - `strict: true` requires EVERY field of EVERY object to be listed in
//   `required` (OpenAI structured outputs rule). Optionality is therefore
//   expressed with `type: ["X", "null"]` unions, never by omitting fields
//   from `required`.
// - The same shape also satisfies Gemini's structured-output dialect
//   (it supports type unions with "null", `anyOf`, and `additionalProperties`)
//   AND — critically — it avoids Gemini's "long runs of optional properties"
//   schema-complexity rejection, which a partially-required schema triggers.
// - "null" must be a member of any `enum` that is nullable.
// - Nulls are bridged into the Zod schema above by `nullsToUndefined`
//   in ./utils before validation, so the Zod side stays null-free.
// - Bounding boxes use Gemini's NATIVE grounding convention: integer
//   coordinates in the 0-1000 range. `normalizeStructuredOCR` detects
//   all-integer responses and rescales to 0-1 fractions deterministically,
//   so downstream code keeps working in normalized fractions.

/**
 * One figure bounding box in the strict-JSON-schema flavor: all four
 * coordinates are required 0-1000 integers, no nulls.
 */
const boundingBoxJsonSchema = {
  type: "object",
  properties: {
    yMin: {
      type: "integer",
      minimum: 0,
      maximum: 1000,
      description:
        "Top edge of the figure's box, as an integer grounding coordinate on the 0-1000 scale of the full page image.",
    },
    xMin: {
      type: "integer",
      minimum: 0,
      maximum: 1000,
      description:
        "Left edge of the figure's box, as an integer grounding coordinate on the 0-1000 scale of the full page image.",
    },
    yMax: {
      type: "integer",
      minimum: 0,
      maximum: 1000,
      description:
        "Bottom edge of the figure's box, as an integer grounding coordinate on the 0-1000 scale of the full page image.",
    },
    xMax: {
      type: "integer",
      minimum: 0,
      maximum: 1000,
      description:
        "Right edge of the figure's box, as an integer grounding coordinate on the 0-1000 scale of the full page image.",
    },
  },
  required: ["yMin", "xMin", "yMax", "xMax"],
  additionalProperties: false,
} as const;

/**
 * Question/Solution: text is always a string ("" when the block is purely a
 * figure); figures is an always-present array (empty when there are none).
 * The whole object is null when the question/solution does not exist.
 */
const textAndFiguresJsonSchema = {
  type: ["object", "null"],
  properties: {
    text: {
      type: "string",
      description:
        "The verbatim text of this question/solution, including LaTeX. Use an empty string only when the block is purely a figure.",
    },
    figures: {
      type: "array",
      items: boundingBoxJsonSchema,
      description:
        "Bounding box for each separate diagram in reading order. Always present; use an empty array when there are none.",
    },
  },
  required: ["text", "figures"],
  additionalProperties: false,
} as const;

/**
 * Option content: both keys always present; `text` or `figure` is null when
 * not applicable. The whole object is null when the option does not exist
 * on the page.
 */
const optionContentJsonSchema = {
  type: ["object", "null"],
  properties: {
    text: {
      type: ["string", "null"],
      description: "The verbatim option text; null if the option is a pure diagram.",
    },
    figure: {
      type: ["object", "null"],
      description:
        "Bounding box of this option's single diagram; null if the option has no diagram.",
      properties: boundingBoxJsonSchema.properties,
      required: boundingBoxJsonSchema.required,
      additionalProperties: false,
    },
  },
  required: ["text", "figure"],
  additionalProperties: false,
} as const;

export const structuredOCRJsonSchema: StructuredJsonOptions = {
  name: "structured_ocr_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      isRelevant: {
        type: "boolean",
        description:
          "False only when the page is blank or contains no extractable questions, solutions, options, or answer keys.",
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
      englishParagraph: {
        type: ["string", "null"],
        description:
          "The full reading-comprehension passage printed on this page, or null.",
      },
      data: {
        type: ["array", "null"],
        items: {
          type: "object",
          properties: {
            serialNo: {
              type: "number",
              description:
                "The serial number exactly as printed for this item in the document.",
            },
            question: textAndFiguresJsonSchema,
            options: {
              type: ["object", "null"],
              properties: {
                A: optionContentJsonSchema,
                B: optionContentJsonSchema,
                C: optionContentJsonSchema,
                D: optionContentJsonSchema,
              },
              required: ["A", "B", "C", "D"],
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
            solution: textAndFiguresJsonSchema,
            isContinuation: {
              type: ["boolean", "null"],
              description:
                "True when this item continues an entity from the previous page and its serial number was carried forward.",
            },
          },
          required: [
            "serialNo",
            "question",
            "options",
            "answerKey",
            "subject",
            "marks",
            "solution",
            "isContinuation",
          ],
          additionalProperties: false,
        },
      },
    },
    required: [
      "isRelevant",
      "sectionLabel",
      "sectionStart",
      "sectionEnd",
      "eachMarks",
      "englishParagraph",
      "data",
    ],
    additionalProperties: false,
  },
};

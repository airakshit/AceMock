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

// ---------------------------------------------------------------------------
// STAGE 1: Text / LaTeX extraction with hasFigure flags
// ---------------------------------------------------------------------------

/** Question/Solution text content: text required, hasFigure boolean instead of figures array.
 * The model reports whether a block contains any figure/diagram without locating it. */
const partialTextAndFiguresSchema = z
  .object({
    text: z
      .preprocess((value) => (value == null ? "" : value), z.string())
      .describe(
        "The question or solution text content. Required for question and solution fields.",
      ),
    hasFigure: z
      .boolean()
      .describe(
        "True when this block contains at least one figure, diagram, graph, circuit, or drawn table that needs bounding-box extraction in stage 2.",
      ),
  })
  .strict();

export type PartialTextAndFigures = z.infer<
  typeof partialTextAndFiguresSchema
>;

/**
 * Option content stage 1: text optional, hasFigure boolean instead of figure box.
 * An option that exists must have at least text or hasFigure true. */
const partialOptionContentSchema = z
  .object({
    text: z
      .string()
      .optional()
      .describe("The option text content."),
    hasFigure: z
      .boolean()
      .describe(
        "True when this option consists of a diagram/figure (text may be null).",
      ),
  })
  .strict();

export type PartialOptionContent = z.infer<typeof partialOptionContentSchema>;

const partialQuestionDataSchema = z
  .object({
    serialNo: z
      .coerce
      .number()
      .describe("Primary identifier for every question or solution."),

    question: partialTextAndFiguresSchema.optional(),

    options: z
      .preprocess(
        optionsSchemaPreprocessCb,
        z
          .object({
            A: partialOptionContentSchema.optional(),
            B: partialOptionContentSchema.optional(),
            C: partialOptionContentSchema.optional(),
            D: partialOptionContentSchema.optional(),
          })
          .strict()
          .optional(),
      ),

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

    solution: partialTextAndFiguresSchema.optional(),

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

export type PartialQuestionData = z.infer<typeof partialQuestionDataSchema>;

export const partialOCRExtractionSchema = z
  .object({
    isRelevant: z.boolean().optional(),

    sectionLabel: z.string().optional(),

    sectionStart: z.coerce.number().optional(),

    sectionEnd: z.coerce.number().optional(),

    eachMarks: z.coerce.number().optional(),

    englishParagraph: z.string().optional(),

    data: z
      .array(partialQuestionDataSchema)
      .nullish()
      .transform((val) => val ?? []),
  })
  .strict();

export type PartialSchemaParseResult = z.infer<
  typeof partialOCRExtractionSchema
>;

// ---------------------------------------------------------------------------
// STAGE 1 JSON Schema for API-enforced structured output (response_format)
// ---------------------------------------------------------------------------

const partialTextAndFiguresJsonSchema = {
  type: ["object", "null"],
  properties: {
    text: {
      type: "string",
      description:
        "The verbatim text of this question/solution, including LaTeX. Use an empty string only when the block is purely a figure.",
    },
    hasFigure: {
      type: "boolean",
      description:
        "True when this block contains at least one figure/diagram that needs bounding-box extraction in stage 2.",
    },
  },
  required: ["text", "hasFigure"],
  additionalProperties: false,
} as const;

const partialOptionContentJsonSchema = {
  type: ["object", "null"],
  properties: {
    text: {
      type: ["string", "null"],
      description: "The verbatim option text; null if the option is a pure diagram.",
    },
    hasFigure: {
      type: "boolean",
      description:
        "True when this option consists of a diagram/figure (text may be null).",
    },
  },
  required: ["text", "hasFigure"],
  additionalProperties: false,
} as const;

export const partialOCRJsonSchema: StructuredJsonOptions = {
  name: "partial_ocr_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      isRelevant: {
        type: "boolean",
        description:
          "False only when the page is blank or contains no extractable questions, solutions, options, or answer keys.",
      },
      sectionLabel: { type: ["string", "null"] },
      sectionStart: { type: ["number", "null"] },
      sectionEnd: { type: ["number", "null"] },
      eachMarks: { type: ["number", "null"] },
      englishParagraph: { type: ["string", "null"] },
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
            question: partialTextAndFiguresJsonSchema,
            options: {
              type: ["object", "null"],
              properties: {
                A: partialOptionContentJsonSchema,
                B: partialOptionContentJsonSchema,
                C: partialOptionContentJsonSchema,
                D: partialOptionContentJsonSchema,
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
            solution: partialTextAndFiguresJsonSchema,
            isContinuation: { type: ["boolean", "null"] },
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

// ---------------------------------------------------------------------------
// STAGE 2: Bounding box extraction for items that have figures
// ---------------------------------------------------------------------------

/** One figure bounding box in 0-1000 integer grounding units. */
const stage2BoundingBoxSchema = z
  .object({
    yMin: z.coerce.number(),
    xMin: z.coerce.number(),
    yMax: z.coerce.number(),
    xMax: z.coerce.number(),
  })
  .strict()
  .transform(({ xMin, yMin, xMax, yMax }) => ({
    xMin: Math.min(xMin, xMax),
    yMin: Math.min(yMin, yMax),
    xMax: Math.max(xMin, xMax),
    yMax: Math.max(yMin, yMax),
  }));

export type Stage2BoundingBox = z.infer<typeof stage2BoundingBoxSchema>;

const stage2OptionFiguresSchema = z
  .object({
    A: stage2BoundingBoxSchema.optional(),
    B: stage2BoundingBoxSchema.optional(),
    C: stage2BoundingBoxSchema.optional(),
    D: stage2BoundingBoxSchema.optional(),
  })
  .strict()
  .optional();

export type Stage2OptionFigures = z.infer<
  typeof stage2OptionFiguresSchema
>;

const stage2ItemSchema = z
  .object({
    serialNo: z
      .coerce
      .number()
      .describe("Serial number of the item containing the figure(s)."),

    questionFigures: z
      .array(stage2BoundingBoxSchema)
      .optional()
      .describe(
        "Bounding boxes for question-stem figures, in reading order.",
      ),

    solutionFigures: z
      .array(stage2BoundingBoxSchema)
      .optional()
      .describe(
        "Bounding boxes for solution figures, in reading order.",
      ),

    optionFigures: stage2OptionFiguresSchema.describe(
      "Per-option figure bounding boxes, keyed A–D. Present only for options with hasFigure=true.",
    ),
  })
  .strict();

export type Stage2Item = z.infer<typeof stage2ItemSchema>;

export const stage2BoundingBoxSchemaRoot = z.object({
  items: z.array(stage2ItemSchema).describe(
    "One entry per item (serialNo) that reported hasFigure=true in stage 1.",
  ),
});

export type Stage2BoundingBoxResult = z.infer<
  typeof stage2BoundingBoxSchemaRoot
>;

// ---------------------------------------------------------------------------
// STAGE 2 JSON Schema for API-enforced structured output (response_format)
// ---------------------------------------------------------------------------

const stage2BoundingBoxJsonSchema = {
  type: "object",
  properties: {
    yMin: {
      type: "integer",
      minimum: 0,
      maximum: 1000,
      description:
        "Top edge of the figure's box, integer grounding coordinate on the 0-1000 scale.",
    },
    xMin: {
      type: "integer",
      minimum: 0,
      maximum: 1000,
      description:
        "Left edge of the figure's box, integer grounding coordinate on the 0-1000 scale.",
    },
    yMax: {
      type: "integer",
      minimum: 0,
      maximum: 1000,
      description:
        "Bottom edge of the figure's box, integer grounding coordinate on the 0-1000 scale.",
    },
    xMax: {
      type: "integer",
      minimum: 0,
      maximum: 1000,
      description:
        "Right edge of the figure's box, integer grounding coordinate on the 0-1000 scale.",
    },
  },
  required: ["yMin", "xMin", "yMax", "xMax"],
  additionalProperties: false,
} as const;

/** Nullable single bounding box, for option keys that may have no figure. */
const stage2BoundingBoxNullableJsonSchema = {
  type: ["object", "null"],
  properties: stage2BoundingBoxJsonSchema.properties,
  required: stage2BoundingBoxJsonSchema.required,
  additionalProperties: false,
} as const;

const stage2OptionFiguresJsonSchema = {
  type: ["object", "null"],
  properties: {
    A: stage2BoundingBoxNullableJsonSchema,
    B: stage2BoundingBoxNullableJsonSchema,
    C: stage2BoundingBoxNullableJsonSchema,
    D: stage2BoundingBoxNullableJsonSchema,
  },
  required: ["A", "B", "C", "D"],
  additionalProperties: false,
} as const;

const stage2ItemJsonSchema = {
  type: "object",
  properties: {
    serialNo: {
      type: "number",
      description: "Serial number of the item containing the figure(s).",
    },
    questionFigures: {
      type: "array",
      items: stage2BoundingBoxJsonSchema,
      description: "Bounding boxes for question-stem figures, in reading order.",
    },
    solutionFigures: {
      type: "array",
      items: stage2BoundingBoxJsonSchema,
      description: "Bounding boxes for solution figures, in reading order.",
    },
    optionFigures: stage2OptionFiguresJsonSchema,
  },
  required: ["serialNo", "questionFigures", "solutionFigures", "optionFigures"],
  additionalProperties: false,
} as const;

export const stage2BoundingBoxRootJsonSchema: StructuredJsonOptions = {
  name: "stage2_bounding_box_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: stage2ItemJsonSchema,
        description:
          "One entry per item (serialNo) that reported hasFigure=true in stage 1.",
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
};

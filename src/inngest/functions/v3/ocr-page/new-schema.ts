/**
 * V3 extraction schemas — PATH-BASED identity.
 *
 * Entities are identified by `path`: the chain of printed labels from the
 * top of the document hierarchy down to the entity, verbatim as printed.
 *   e.g. parent question 4, sub-question (ii)  ->  ["4", "ii"]
 *
 * Two stage schemas live here:
 *  1. `partialOCRJsonSchema` (stage 1) — text/LaTeX extraction + hasFigure
 *     flags. NO bounding boxes. Each question/solution/option only reports
 *     whether it contains a figure.
 *  2. `stage2BoundingBoxRootJsonSchema` (stage 2) — runs only when any
 *     hasFigure=true, and extracts bounding boxes for exactly those items,
 *     keyed by the same path (0-1000 native Gemini grounding integers).
 *
 * The merged (production) output schema lives in ./super-schema.
 */
import { z } from "zod";
import type { StructuredJsonOptions } from "@/services/llm/base";

const difficultyEnum = z.enum(["easy", "medium", "hard"]);

// ---------------------------------------------------------------------------
// V2-PORTED PREPROCESSING HELPERS
// All the defensive cleaning v2 applied at the Zod layer, carried over to the
// path-based v3 schema (see v2 structured-question-schema.ts /
// partial-schema.ts `optionsSchemaPreprocessCb`, answerKey/subject
// transforms, coerce.number, null->"" text, nullish array tolerance).
// ---------------------------------------------------------------------------

/** Coerces stringly booleans ("true"/"false"/"1") and numbers to booleans. */
const booleanSchema = z.preprocess(
  (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "1") return true;
      if (normalized === "false" || normalized === "0") return false;
    }
    if (typeof value === "number") return value !== 0;
    return value;
  },
  z.boolean(),
);

/**
 * Removes symbols from option keys and uppercases them, exactly like v2:
 * "(a)" / "a." / "b)" -> "A"/"B". Additionally accept numeric labels
 * "(1)".."(4)" mapped by visual order to A..D (the prompt asks for letters
 * but some providers echo the printed numeric labels).
 */
export const optionsSchemaPreprocessCb = (value: unknown) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }

  const normalized: Record<string, unknown> = { ...(value as Record<string, unknown>) };

  for (const key of Object.keys(normalized)) {
    const trimmed = key.trim();
    let cleanedKey = trimmed.replace(
      /^\(?([a-d])\)?\.?$/i,
      (_, letter: string) => letter.toUpperCase(),
    );

    const numericMatch = trimmed.match(/^\(?([1-4])\)?\.?$/);
    if (numericMatch) {
      cleanedKey = ["A", "B", "C", "D"][Number(numericMatch[1]) - 1];
    }

    if (cleanedKey !== key) {
      // Existing canonical key wins (v2 semantics).
      if (normalized[cleanedKey] === undefined) {
        normalized[cleanedKey] = normalized[key];
      }
      delete normalized[key];
    }
  }
  return normalized;
};

/**
 * Path segments arrive verbatim; cleaning here is DEFENSIVE only:
 * - number segments ("4" as JSON number) become strings,
 * - whitespace is trimmed,
 * - empty/null segments are dropped,
 * - a bare string path ("4.ii") or a bare number collapses into a chain.
 * A malformed path (object etc.) is dropped to undefined so the optional
 * schema treats it as "no printed label" instead of failing the page.
 */
const pathPreprocessCb = (value: unknown): string[] | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return [String(value)];
  if (typeof value === "string") {
    const segment = value.trim();
    return segment ? [segment] : undefined;
  }
  if (Array.isArray(value)) {
    const segments = value
      .map((segment) => {
        if (typeof segment === "string") return segment.trim();
        if (typeof segment === "number") return String(segment);
        return "";
      })
      .filter((segment) => segment.length > 0);
    return segments.length > 0 ? segments : undefined;
  }
  return undefined;
};

const pathSchema = z.preprocess(
  pathPreprocessCb,
  z.array(z.string()).optional(),
);

/** answerValue: pure-numeric strings become numbers; raw null -> undefined. */
const answerValueSchema = z.preprocess(
  (value) => {
    if (value === null) return undefined;
    if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) {
      return Number(value.trim());
    }
    return value;
  },
  z.union([z.string(), z.number()]).optional(),
);

// ---------------------------------------------------------------------------
// STAGE 1 — text / LaTeX extraction + hasFigure detection
// ---------------------------------------------------------------------------

const subjectEnum = z.enum([
  "math",
  "physics",
  "chemistry",
  "grammar",
  "comprehension",
]);

/** v2 semantics: lowercase + trim before the enum pipe; v3 additionally
 * folds the "maths"/"mathematics" aliases onto v3's "math" value. */
const subjectSchema = z
  .string()
  .transform((value) => {
    const normalized = value.toLowerCase().trim();
    return normalized === "maths" || normalized === "mathematics"
      ? "math"
      : normalized;
  })
  .pipe(subjectEnum);

const answerKeyEnum = z.enum(["A", "B", "C", "D"]);

/** v2 semantics: strip "."/"("/") decorations and uppercase before enum. */
const answerKeySchema = z
  .string()
  .transform((value) =>
    value
      .toUpperCase()
      .replace(/[.()\s]/g, "")
      .trim(),
  )
  .pipe(answerKeyEnum)
  .optional();

const textAndFigureSchema = z.object({
  text: z
    .preprocess(
      (value) => (value == null ? "" : value),
      z.string(),
    )
    .optional(),
  hasFigure: booleanSchema,
});

const questionAndSolutionSchema = textAndFigureSchema.extend({
  marks: z.coerce.number().optional(),
  difficulty: difficultyEnum.optional(),
  subject: subjectSchema.optional(),
  /**
   * True when this block can be represented as a standalone question
   * WITHOUT any data from the parent question directive or any content
   * from other pages. Subquestions spread across pages rely on this to
   * decide whether the parent stem must be joined. Continuation/CUT-OFF
   * handling is NOT this flag's job — pages report isStartOpen/isEndOpen.
   */
  isStandalone: booleanSchema.optional(),
  /**
   * Standalone printed answer value (subjective / numeric). Lives on the
   * solution block: a solution entity carries its answer here. Question
   * blocks do not use it.
   */
  answerValue: answerValueSchema,
});

const passageSchema = z.object({
  text: z.string(),
});

const optionContentSchema = z.object({
  text: z
    .preprocess((value) => (typeof value === "string" ? value : undefined), z.string().optional()),
  hasFigure: booleanSchema,
});

const optionsSchema = z.preprocess(
  optionsSchemaPreprocessCb,
  z.object({
    A: optionContentSchema.optional(),
    B: optionContentSchema.optional(),
    C: optionContentSchema.optional(),
    D: optionContentSchema.optional(),
  }),
);

export const entitySchema = z
  .object({
    /**
     * Printed label chain, verbatim. Entities whose ancestor labels are not
     * printed on the page emit the visible suffix only (e.g. ["ii"]); the
     * stitcher reconstructs the full chain structurally. Omitted entirely
     * when no label is visible (unlabeled continuation).
     */
    path: pathSchema,
    passage: passageSchema.optional(),
    question: questionAndSolutionSchema.optional(),
    solution: questionAndSolutionSchema.optional(),
    options: optionsSchema.optional(),
    answerKey: answerKeySchema,
  })
  .refine(
    (entity) =>
      entity.passage !== undefined ||
      entity.question !== undefined ||
      entity.solution !== undefined ||
      entity.options !== undefined ||
      entity.answerKey !== undefined,
    {
      message:
        "Each entity must be one of: passage, question/solution/options, or an answer row.",
    },
  );

const pageSectionsSchema = z.object({
  label: z.string(),
  start: z
    .union([z.string().trim(), z.coerce.number()])
    .transform((value) => (typeof value === "string" && value === "" ? undefined : value))
    .optional(),
  end: z
    .union([z.string().trim(), z.coerce.number()])
    .transform((value) => (typeof value === "string" && value === "" ? undefined : value))
    .optional(),
  eachMarks: z.coerce.number().optional(),
});

export const pageSchema = z
  .object({
    pageNo: z.coerce.number().optional(),
    isRelevant: booleanSchema,
    /** Page opens mid-entity (continuation from the previous page). */
    isStartOpen: booleanSchema,
    /** Page ends mid-entity (entity continues onto the next page). */
    isEndOpen: booleanSchema,
    sections: z
      .array(pageSectionsSchema)
      .nullish()
      .transform((value) => value ?? undefined),
    entities: z
      .array(entitySchema)
      .nullish()
      .transform((value) => value ?? []),
  })
  .strict();

// ---------------------------------------------------------------------------
// STAGE 2 — bounding boxes keyed by path
// ---------------------------------------------------------------------------

/**
 * Native Gemini grounding convention: boxes are emitted as INTEGER
 * coordinates on a 0-1000 grid. v2 semantics: each coordinate is COERCED
 * (string coordinates survive), no hard Zod bounds — scale classification
 * and repair happen in the parse utilities (rescaleNativeGroundingBoxes /
 * repairStage2ItemScale). The transform fixes swapped min/max orientation,
 * which stray grounding outputs occasionally produce.
 */
const stage2BBoxCoordSchema = z.coerce.number();

export const stage2BoundingBoxSchema = z
  .object({
    xMin: stage2BBoxCoordSchema,
    yMin: stage2BBoxCoordSchema,
    xMax: stage2BBoxCoordSchema,
    yMax: stage2BBoxCoordSchema,
  })
  .transform(({ xMin, yMin, xMax, yMax }) => ({
    xMin: Math.min(xMin, xMax),
    xMax: Math.max(xMin, xMax),
    yMin: Math.min(yMin, yMax),
    yMax: Math.max(yMin, yMax),
  }));

export const stage2OptionFiguresSchema = z.preprocess(
  optionsSchemaPreprocessCb,
  z.object({
    A: stage2BoundingBoxSchema.nullish().transform((v) => v ?? undefined),
    B: stage2BoundingBoxSchema.nullish().transform((v) => v ?? undefined),
    C: stage2BoundingBoxSchema.nullish().transform((v) => v ?? undefined),
    D: stage2BoundingBoxSchema.nullish().transform((v) => v ?? undefined),
  }),
);

/** Path null/omitted = the unlabeled continuation entity. */
export const stage2ItemSchema = z.object({
  path: pathSchema,
  questionFigures: z
    .array(stage2BoundingBoxSchema)
    .nullish()
    .transform((value) => value ?? []),
  solutionFigures: z
    .array(stage2BoundingBoxSchema)
    .nullish()
    .transform((value) => value ?? []),
  optionFigures: stage2OptionFiguresSchema
    .nullish()
    .transform((value) => value ?? undefined),
});

export const stage2RootSchema = z.object({
  items: z
    .array(stage2ItemSchema)
    .nullish()
    .transform((value) => value ?? []),
});

// ---------------------------------------------------------------------------
// Exported_TYPES
// ---------------------------------------------------------------------------

export type PartialTextAndFigure = z.infer<typeof textAndFigureSchema>;
export type PartialQuestionOrSolution = z.infer<
  typeof questionAndSolutionSchema
>;
export type PartialPassage = z.infer<typeof passageSchema>;
export type PartialOptions = z.infer<typeof optionsSchema>;
export type PartialEntity = z.infer<typeof entitySchema>;
export type PartialPageSection = z.infer<typeof pageSectionsSchema>;
export type PartialPageParseResult = z.infer<typeof pageSchema>;

export type Stage2BoundingBox = z.infer<typeof stage2BoundingBoxSchema>;
export type Stage2OptionFigures = z.infer<typeof stage2OptionFiguresSchema>;
export type Stage2Item = z.infer<typeof stage2ItemSchema>;
export type Stage2BoundingBoxResult = z.infer<typeof stage2RootSchema>;

// ---------------------------------------------------------------------------
// STRICT JSON SCHEMAS (all-required + nullable unions)
// ---------------------------------------------------------------------------
// OpenAI strict mode AND Gemini both reject bare "optional" properties:
// every key must be present, optionality expressed with null. Zod parse
// downstream strips the nulls (nullsToUndefined) — the Zod schemas above
// never see them.

const nullableString = { type: ["string", "null"] } as const;
const nullableNumber = { type: ["number", "null"] } as const;
const nullableBoolean = { type: ["boolean", "null"] } as const;
const nullableInteger = { type: ["integer", "null"] } as const;

const textAndFigureJsonSchema = {
  type: ["object", "null"],
  properties: {
    text: nullableString,
    hasFigure: { type: "boolean" },
  },
  required: ["text", "hasFigure"],
  additionalProperties: false,
} as const;

const questionAndSolutionJsonSchema = {
  type: ["object", "null"],
  properties: {
    text: nullableString,
    hasFigure: { type: "boolean" },
    marks: nullableNumber,
    difficulty: { type: ["string", "null"], enum: ["easy", "medium", "hard", "null"] },
    subject: {
      type: ["string", "null"],
      enum: ["math", "physics", "chemistry", "grammar", "comprehension", "null"],
    },
    isStandalone: { type: ["boolean", "null"] },
    answerValue: { type: ["string", "number", "null"] },
  },
  required: ["text", "hasFigure", "marks", "difficulty", "subject"],
  additionalProperties: false,
} as const;

const passageJsonSchema = {
  type: ["object", "null"],
  properties: {
    text: { type: "string" },
  },
  required: ["text"],
  additionalProperties: false,
} as const;

const optionsJsonSchema = {
  type: ["object", "null"],
  properties: {
    A: textAndFigureJsonSchema,
    B: textAndFigureJsonSchema,
    C: textAndFigureJsonSchema,
    D: textAndFigureJsonSchema,
  },
  required: ["A", "B", "C", "D"],
  additionalProperties: false,
} as const;

const entityJsonSchema = {
  type: "object",
  properties: {
    path: {
      type: ["array", "null"],
      items: { type: "string" },
    },
    passage: passageJsonSchema,
    question: questionAndSolutionJsonSchema,
    solution: questionAndSolutionJsonSchema,
    options: optionsJsonSchema,
    answerKey: {
      type: ["string", "null"],
      enum: ["A", "B", "C", "D", "null"],
    },
  },
  required: [
    "path",
    "passage",
    "question",
    "solution",
    "options",
    "answerKey",
  ],
  additionalProperties: false,
} as const;

const pageSectionsJsonSchema = {
  type: ["object", "null"],
  properties: {
    label: { type: "string" },
    start: { type: ["string", "number", "null"] },
    end: { type: ["string", "number", "null"] },
    eachMarks: nullableNumber,
  },
  required: ["label", "start", "end", "eachMarks"],
  additionalProperties: false,
} as const;

const partialOCRRawJsonSchema = {
  type: "object",
  properties: {
    pageNo: nullableInteger,
    isRelevant: { type: "boolean" },
    isStartOpen: { type: "boolean" },
    isEndOpen: { type: "boolean" },
    sections: {
      type: ["array", "null"],
      items: pageSectionsJsonSchema,
    },
    entities: {
      type: ["array", "null"],
      items: entityJsonSchema,
    },
  },
  required: [
    "pageNo",
    "isRelevant",
    "isStartOpen",
    "isEndOpen",
    "sections",
    "entities",
  ],
  additionalProperties: false,
} as const;

const stage2BoundingBoxJsonSchema = {
  type: ["object", "null"],
  properties: {
    xMin: { type: "integer", minimum: 0, maximum: 1000 },
    yMin: { type: "integer", minimum: 0, maximum: 1000 },
    xMax: { type: "integer", minimum: 0, maximum: 1000 },
    yMax: { type: "integer", minimum: 0, maximum: 1000 },
  },
  required: ["xMin", "yMin", "xMax", "yMax"],
  additionalProperties: false,
} as const;

const stage2OptionFiguresJsonSchema = {
  type: ["object", "null"],
  properties: {
    A: stage2BoundingBoxJsonSchema,
    B: stage2BoundingBoxJsonSchema,
    C: stage2BoundingBoxJsonSchema,
    D: stage2BoundingBoxJsonSchema,
  },
  required: ["A", "B", "C", "D"],
  additionalProperties: false,
} as const;

const stage2ItemJsonSchema = {
  type: "object",
  properties: {
    path: {
      type: ["array", "null"],
      items: { type: "string" },
    },
    questionFigures: {
      type: ["array", "null"],
      items: stage2BoundingBoxJsonSchema,
    },
    solutionFigures: {
      type: ["array", "null"],
      items: stage2BoundingBoxJsonSchema,
    },
    optionFigures: stage2OptionFiguresJsonSchema,
  },
  required: ["path", "questionFigures", "solutionFigures", "optionFigures"],
  additionalProperties: false,
} as const;

const stage2BoundingBoxRootRawJsonSchema = {
  type: "object",
  properties: {
    items: {
      type: ["array", "null"],
      items: stage2ItemJsonSchema,
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

// ---------------------------------------------------------------------------
// LLM structured-output OPTIONS (v2 semantics: the service receives the
// full { name, schema, strict } envelope, not the bare schema)
// ---------------------------------------------------------------------------

export const partialOCRJsonSchema: StructuredJsonOptions = {
  name: "partial_ocr",
  schema: partialOCRRawJsonSchema,
  strict: true,
};

export const stage2BoundingBoxRootJsonSchema: StructuredJsonOptions = {
  name: "stage2_bounding_boxes",
  schema: stage2BoundingBoxRootRawJsonSchema,
  strict: true,
};

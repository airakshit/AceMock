import { z } from "zod";
import type { StructuredJsonOptions } from "@/services/llm/base";


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

  const normalized: Record<string, unknown> = {
    ...(value as Record<string, unknown>),
  };

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

/** Canonical subject values, exactly as the model must emit them. */
const subjectEnum = z.enum([
  "maths",
  "physics",
  "chemistry",
  "grammar",
  "comprehension",
]);

/**
 * The strict JSON schema expresses "absent" with the STRING "null" for
 * enum/number fields (and nullable types with JSON null). Map both — plus
 * empty strings — to undefined BEFORE the inner schema, so a schema-permitted
 * "null" never fails the whole page (JSON null is already stripped by
 * nullsToUndefined upstream, this catches the string form).
 */
const nullableToUndefined = (value: unknown) =>
  value === "null" || value === "" || value == null ? undefined : value;

const subjectSchema = z.preprocess(nullableToUndefined, subjectEnum.optional());

const numberSchema = z.preprocess(
  nullableToUndefined,
  z.coerce.number().optional(),
);

const answerKeyEnum = z.enum(["A", "B", "C", "D"]);

/** v2 semantics: strip "."/"("/") decorations and uppercase before enum. */
const answerKeySchema = z.preprocess(
  nullableToUndefined,
  z
    .string()
    .transform((value) =>
      value
        .toUpperCase()
        .replace(/[.()\s]/g, "")
        .trim(),
    )
    .pipe(answerKeyEnum)
    .optional(),
);

/** Boolean coercion (v2 semantics): booleans may arrive as true/false,
 *  "true"/"false", "1"/"0" strings, or 1/0 numbers.
 */
const booleanSchema = z.preprocess((value) => {
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return value;
}, z.boolean());

/** Printed label chain — the verbatim path. Coercions (v2 semantics):
 *  numbers -> strings, null/empty segments dropped, a bare string collapses
 *  to a one-segment chain, and garbage values collapse to "no printed label"
 *  (undefined) instead of failing the whole page.
 */
const pathSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? undefined : [trimmed];
    }
    if (!Array.isArray(value)) return undefined;
    const segments = value
      .filter((segment) => segment != null)
      .map((segment) => String(segment).trim())
      .filter((segment) => segment !== "");
    return segments.length > 0 ? segments : undefined;
  },
  // `.optional()` INSIDE: garbage collapses to "no printed label" (path
  // absent) instead of failing the whole page. An outer .optional() would
  // let the inner z.array fail on undefined.
  z.array(z.string()).optional(),
);

/** Numeric-looking answer strings ("42") coerce to numbers (v2 semantics). */
const answerValueSchema = z.preprocess(
  (value) => {
    if (value === "null") return undefined;
    return typeof value === "string"
      ? /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/.test(value.trim())
        ? Number(value.trim())
        : value
      : value;
  },
  z.union([z.string(), z.number()]).optional(),
);

const textAndFigureSchema = z.object({
  text: z
    .preprocess((value) => (value == null ? "" : value), z.string())
    .optional(),
  hasFigure: booleanSchema,
});

const questionSchema = textAndFigureSchema.extend({
  marks: numberSchema,
  subject: subjectSchema,
  isStandalone: booleanSchema,
});

const solutionSchema = textAndFigureSchema.extend({
  marks: numberSchema,
  subject: subjectSchema,
  isStandalone: booleanSchema,
  // Final solution value if possible.
  answerValue: answerValueSchema.optional(),
});

const passageSchema = z.object({
  text: z.string(),
  /** Printed label chain of the first question the passage covers. */
  startQuestionPath: z.array(z.string()).optional(),
  /** Printed label chain of the last question the passage covers. */
  endQuestionPath: z.array(z.string()).optional(),
});

const optionsSchema = z.preprocess(
  optionsSchemaPreprocessCb,
  z.object({
    A: textAndFigureSchema.optional(),
    B: textAndFigureSchema.optional(),
    C: textAndFigureSchema.optional(),
    D: textAndFigureSchema.optional(),
  }),
);

/**
 * One page-boundary FRAGMENT: exactly the entity shape minus `path`.
 *
 * The fragment's TYPE is declared by which content field(s) are populated
 * (question / solution / options / answerKey / passage) — there is no
 * separate `kind` flag, so a kind/fields mismatch is impossible. Content
 * printed at a page edge (a cut entity) lives here, never in `entities`.
 * Figure-bearing parts carry `hasFigure` like any entity; stage 2 fills
 * their boxes after the stage-1/stage-2 merge.
 */
export const fragmentSchema = z.object({
  passage: passageSchema.optional(),
  question: questionSchema.optional(),
  solution: solutionSchema.optional(),
  options: optionsSchema.optional(),
  answerKey: answerKeySchema,
});

/**
 * One stage-1 entity. NOTE: content-less entities (question/solution/
 * options/answerKey/passage all null — e.g. a bare path marker) are NOT
 * rejected here; they are dropped (and logged) in the `entities` transform
 * of `pageSchema` / in `normalizePartialPage`, because a page that happens
 * to print only unextractable markers must not fail extraction.
 */
export const entitySchema = fragmentSchema.extend({
  path: pathSchema,
});

const pageSectionsSchema = z.object({
  label: z.string(),
  /** Printed label chain where the section's question range begins. */
  startPath: pathSchema,
  /** Printed label chain where the section's question range ends. */
  endPath: pathSchema,
  /** True when the section's range continues a section from the previous page. */
  continuesPathFromPrevious: booleanSchema.optional(),
  eachMarks: numberSchema,
});

/**
 * The printed path of a page-boundary reference, EXACTLY as printed —
 * never inferred. "null"/""/null/garbage all collapse to null (no anchor).
 */
const refPathSchema = z.preprocess(
  (value) => {
    if (value == null || value === "null" || value === "") return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? null : [trimmed];
    }
    if (!Array.isArray(value)) return null;
    const segments = value
      .filter((segment) => segment != null)
      .map((segment) => String(segment).trim())
      .filter((segment) => segment !== "");
    return segments.length > 0 ? segments : null;
  },
  z.array(z.string()).nullish().transform((value) => value ?? null),
);

/** Content-less fragment (all fields null/absent — model noise) → null. */
const fragmentOrNull = fragmentSchema
  .nullish()
  .transform((value) =>
    value &&
    !!(
      value.passage ||
      value.question ||
      value.solution ||
      value.options ||
      value.answerKey !== undefined
    )
      ? value
      : null,
  );

/**
 * Page-TOP state. Exactly ONE of the two fields is set:
 *  - continuation text printed at the top (no printed label of its own):
 *    { refPath: null, obj: <fragment> } — refPath is NEVER set alongside obj;
 *  - fresh page start: { refPath: <the page's first entity's printed path>,
 *    obj: null }.
 * The transform enforces that exclusivity (obj present ⇒ refPath null).
 * A null state object (model noise) becomes a clean fresh start.
 */
export const startStateSchema = z.preprocess(
  (value) => (value == null ? { refPath: null, obj: null } : value),
  z
    .object({
      refPath: refPathSchema,
      obj: fragmentOrNull,
    })
    .strict()
    .transform((state) => (state.obj ? { refPath: null, obj: state.obj } : state)),
);

/**
 * Page-BOTTOM state — a pure REFERENCE: the printed path of the page's last
 * entity, never null in the contract. It has NO `obj`: the last entity's
 * content — complete or cut mid-way — lives in `entities` under its printed
 * path. This pointer tells the stitcher which item the next page may
 * continue; the next page's startState decides whether it actually does.
 */
export const endStateSchema = z.preprocess(
  (value) => (value == null ? { refPath: null } : value),
  z
    .object({
      refPath: refPathSchema,
    })
    .strict(),
);

export const pageSchema = z
  .object({
    // page no printed on the page.
    pageNo: numberSchema,
    isRelevant: booleanSchema,
    /** Page TOP: continuation fragment OR the first entity's path reference. */
    startState: startStateSchema,
    /** Page BOTTOM: reference to the page's last entity (never a fragment). */
    endState: endStateSchema,
    sections: z
      .array(pageSectionsSchema)
      .nullish()
      .transform((value) => value ?? undefined),
    entities: z
      // Null array items are dropped, not rejected: a page whose entities
      // are all null is an empty page (logged upstream in
      // normalizePartialPage), never a validation failure.
      .array(entitySchema.nullable())
      .nullish()
      .transform((value) =>
        (value ?? []).filter(
          (entity): entity is z.infer<typeof entitySchema> =>
            entity != null &&
            // Content-less entities (question/solution/options/answerKey/
            // passage all null — e.g. a bare path marker) are model noise:
            // dropped + logged upstream, never a page failure.
            !!(
              entity.passage ||
              entity.question ||
              entity.solution ||
              entity.options ||
              entity.answerKey
            ),
        ),
      ),
  })
  .strict();

// ---------------------------------------------------------------------------
// STAGE 2 — bounding boxes keyed by path
// ---------------------------------------------------------------------------

/**
 * Native Gemini grounding convention: boxes are emitted as INTEGER
 * coordinates on a 0-1000 grid.
 *
 * Scale classification and repair happen in the parse utilities
 * (rescaleNativeGroundingBoxes / repairStage2ItemScale).
 *
 * The transform fixes swapped min/max orientation,
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
  // Same coercion as stage 1 so echo paths survive number/null/empty issues
  // and stay bindable by pathKey.
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
  /**
   * True when stage 2 read the entity's question/option text and found NO
   * diagram on the page that actually corresponds to it. Drives the
   * `figure_not_found` failure reason downstream (distinct from a stray
   * missing box).
   */
  noMatchingFigure: booleanSchema
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
export type PartialQuestion = z.infer<typeof questionSchema>;
export type PartialSolution = z.infer<typeof solutionSchema>;
export type PartialPassage = z.infer<typeof passageSchema>;
export type PartialOptions = z.infer<typeof optionsSchema>;
export type PartialStartState = z.infer<typeof startStateSchema>;
export type PartialEndState = z.infer<typeof endStateSchema>;
export type PartialFragment = z.infer<typeof fragmentSchema>;
export type PartialEntity = z.infer<typeof entitySchema>;
export type PartialPageSection = z.infer<typeof pageSectionsSchema>;
export type PartialPageParseResult = z.infer<typeof pageSchema>;

export type Stage2BoundingBox = z.infer<typeof stage2BoundingBoxSchema>;
export type Stage2OptionFigures = z.infer<typeof stage2OptionFiguresSchema>;
export type Stage2Item = z.infer<typeof stage2ItemSchema>;
export type Stage2BoundingBoxResult = z.infer<typeof stage2RootSchema>;


// JSON schema for structured output.

const nullableString = { type: ["string", "null"] } as const;
const nullableNumber = { type: ["number", "null"] } as const;
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
    subject: {
      type: ["string", "null"],
      enum: [
        "maths",
        "physics",
        "chemistry",
        "grammar",
        "comprehension",
        "null",
      ],
    },
    isStandalone: { type: "boolean" },
    answerValue: { type: ["string", "number", "null"] },
  },
  required: ["text", "hasFigure", "marks", "subject", "isStandalone"],
  additionalProperties: false,
} as const;

const passageJsonSchema = {
  type: ["object", "null"],
  properties: {
    text: { type: "string" },
    startQuestionPath: {
      type: ["array", "null"],
      items: { type: "string" },
    },
    endQuestionPath: {
      type: ["array", "null"],
      items: { type: "string" },
    },
  },
  required: ["text", "startQuestionPath", "endQuestionPath"],
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

const fragmentJsonSchema = {
  type: ["object", "null"],
  properties: {
    passage: passageJsonSchema,
    question: questionAndSolutionJsonSchema,
    solution: questionAndSolutionJsonSchema,
    options: optionsJsonSchema,
    answerKey: {
      type: ["string", "null"],
      enum: ["A", "B", "C", "D", "null"],
    },
  },
  required: ["passage", "question", "solution", "options", "answerKey"],
  additionalProperties: false,
} as const;

const entityJsonSchema = {
  type: "object",
  properties: {
    path: {
      type: ["array", "null"],
      items: { type: "string" },
      description:
        'Printed label chain of the entity, VERBATIM (e.g. ["4","ii"]). NEVER inferred. Null ONLY for a passage entity (passages have no printed label) — every question/solution/answer-row entity carries its printed path.',
    },
    ...fragmentJsonSchema.properties,
  },
  required: ["path", ...fragmentJsonSchema.required],
  additionalProperties: false,
} as const;

const startStateJsonSchema = {
  type: "object",
  properties: {
    refPath: {
      type: ["array", "null"],
      items: { type: "string" },
      description:
        "Printed path of the page's FIRST entity, VERBATIM — printed only when the page starts fresh with a labelled entity. Null when the page top holds continuation text instead (a fragment whose label is not re-printed here).",
    },
    obj: fragmentJsonSchema,
  },
  required: ["refPath", "obj"],
  additionalProperties: false,
  // CONTRACT: exactly one of refPath/obj is populated: refPath+null obj
  // = fresh labelled start; null refPath+obj = continuation fragment at top.
} as const;

const endStateJsonSchema = {
  type: "object",
  properties: {
    refPath: {
      type: ["array", "null"],
      items: { type: "string" },
      description:
        "Printed path of the page's LAST entity, VERBATIM (same PATH rules as entities). Never null in the contract — the bottom of the page always ends on some entity's printed path, whether that entity is complete or cut mid-way. No fragment content lives here; the bottom entity's content is in `entities` under its path.",
    },
  },
  required: ["refPath"],
  additionalProperties: false,
} as const;

const pageSectionsJsonSchema = {
  type: ["object", "null"],
  properties: {
    label: {
      type: "string",
      description:
        "The section's printed heading text, verbatim (e.g. \"Section B\"). For a bare numeric annotation like \"1x60=60\", use the printed text itself.",
    },
    startPath: {
      type: ["array", "null"],
      items: { type: "string" },
      description:
        "Printed label chain of the FIRST question the section covers (e.g. [\"4\"]). Fill when the section states where it begins or a numeric pattern fixes it (\"1x60=60\" -> [\"1\"]); null otherwise.",
    },
    endPath: {
      type: ["array", "null"],
      items: { type: "string" },
      description:
        "Printed label chain of the LAST question the section covers. STRICT: only when the end is explicitly stated (\"Q.4 to Q.20\") or exactly derivable from a printed numeric pattern (\"1x60=60\" -> [\"60\"]). NEVER guess from where the page's content stops or extend across pages. Null when the end is not stated.",
    },
    continuesPathFromPrevious: {
      type: ["boolean", "null"],
      description:
        "true only when this page's section declaration continues a section declared on an earlier page (header repeats or prints \"contd.\").",
    },
    eachMarks: {
      ...nullableNumber,
      description:
        "Marks per question stated by the section: \"2 marks each\" -> 2, \"1x60=60\" -> 1, \"5x8=40\" -> 5. Null when not stated.",
    },
  },
  required: [
    "label",
    "startPath",
    "endPath",
    "continuesPathFromPrevious",
    "eachMarks",
  ],
  additionalProperties: false,
} as const;

const partialOCRRawJsonSchema = {
  type: "object",
  properties: {
    pageNo: nullableInteger,
    isRelevant: { type: "boolean" },
    startState: {
      ...startStateJsonSchema,
      description:
        "What this page OPENS with: either a fresh start labelled by the first entity's printed path ({refPath, obj: null}), or a continuation fragment at the top whose label is not re-printed here ({refPath: null, obj: <fragment>}). Exactly one of refPath/obj is populated. The fragment must NOT also appear in entities.",
    },
    endState: {
      ...endStateJsonSchema,
      description:
        "What this page ENDS on: the printed path of the page's last entity, never null in the contract. No fragment content lives here — the bottom entity's content (complete or cut mid-way) is in `entities` under its printed path. This reference tells the stitcher which item the next page may continue.",
    },
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
    "startState",
    "endState",
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
    noMatchingFigure: {
      type: ["boolean", "null"],
    },
  },
  required: [
    "path",
    "questionFigures",
    "solutionFigures",
    "optionFigures",
    "noMatchingFigure",
  ],
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

/**
 * V3 SUPER SCHEMA — the merged production output of the two-stage OCR flow.
 *
 * Shape mirrors ./partial-schemas (stage 1) but every `hasFigure` boolean is
 * replaced by actual figure data merged in from stage 2:
 *   - question/solution:  figures: BoundingBox[]
 *   - options:            figure?: BoundingBox  (one box per option)
 *
 * Bounding boxes are NORMALIZED 0-1 fractions (origin top-left). Stage 2
 * emits 0-1000 native Gemini grounding integers; the deterministic /1000
 * rescale happens exactly once, in the stage-1/stage-2 merge.
 */
import { z } from "zod";

export const boundingBoxSchema = z.object({
  xMin: z.number(),
  yMin: z.number(),
  xMax: z.number(),
  yMax: z.number(),
});

export type BoundingBox = z.infer<typeof boundingBoxSchema>;

const contentWithFiguresSchema = z.object({
  text: z.string().optional(),
  figures: z.array(boundingBoxSchema),
});

const richContentSchema = contentWithFiguresSchema.extend({
  marks: z.number().optional(),
  subject: z
    .enum(["maths", "physics", "chemistry", "grammar", "comprehension"])
    .optional(),
  /**
   * True when this block can stand alone without parent stem or content
   * from other pages. Used by the stitcher to decide whether to join the
   * parent stem into a subquestion's text.
   */
  isStandalone: z.boolean().optional(),
  /**
   * Standalone printed answer value (subjective / numeric). Lives on the
   * solution block: a solution entity carries its answer here.
   */
  answerValue: z.union([z.string(), z.number()]).optional(),
});

const superOptionsSchema = z.object({
  A: z
    .object({
      text: z.string().optional(),
      figure: boundingBoxSchema.optional(),
    })
    .optional(),
  B: z
    .object({
      text: z.string().optional(),
      figure: boundingBoxSchema.optional(),
    })
    .optional(),
  C: z
    .object({
      text: z.string().optional(),
      figure: boundingBoxSchema.optional(),
    })
    .optional(),
  D: z
    .object({
      text: z.string().optional(),
      figure: boundingBoxSchema.optional(),
    })
    .optional(),
});

export const superPassageSchema = z.object({
  text: z.string(),
  /** Printed label chain of the first question the passage covers. */
  startQuestionPath: z.array(z.string()).optional(),
  /** Printed label chain of the last question the passage covers. */
  endQuestionPath: z.array(z.string()).optional(),
});

export type SuperPassage = z.infer<typeof superPassageSchema>;

/**
 * A resolved-content entity on a page. Exactly one "kind" is populated
 * (enforced by prompts + downstream validation, not by the schema):
 *   - passage entity:  `passage` set
 *   - question entity: `question` and/or `solution` / `options`
 *   - answer row:      only `path` + `answerKey`, with `answerValue` inside `solution`
 *
 * `path` may be a printed SUFFIX of the full label chain (the page did not
 * print the ancestors); the stitching engine reconstructs full chains
 * structurally from the numbering context — there is no explicit flag for
 * this, the identity inference is driven by path shape alone.
 */
export const superEntitySchema = z.object({
  path: z.array(z.string()).optional(),
  passage: superPassageSchema.optional(),
  question: richContentSchema.optional(),
  solution: richContentSchema.optional(),
  options: superOptionsSchema.optional(),
  answerKey: z.enum(["A", "B", "C", "D"]).optional(),
  /**
   * False when stage 1 reported a figure (hasFigure=true) for some part of
   * this entity (question stem / solution / an option) but stage 2 failed to
   * localize the corresponding diagram. True (or absent) means every
   * requested figure was resolved — or nothing was requested.
   */
  figureResolved: z.boolean().optional(),
  /**
   * True when stage 2 read the entity's question/option text and explicitly
   * reported that NO diagram on the page matches it (a confident negative,
   * distinct from a stray missing box).
   */
  figureNotFound: z.boolean().optional(),
});

/**
 * A page-boundary fragment: exactly the entity shape minus `path`. The
 * populated content field(s) declare the fragment's type. Figure boxes are
 * merged in by stage 2 exactly like entities; a pathless fragment's crops
 * are keyed under a synthetic slot ("@start" / "@end") and re-bound to the
 * paired item's path during stitching.
 */
export const superFragmentSchema = superEntitySchema.omit({ path: true });

export type SuperFragment = z.infer<typeof superFragmentSchema>;

/**
 * Page-TOP state: continuation fragment OR the first entity's path
 * reference. Exactly one of refPath/obj is populated.
 */
export const superStartStateSchema = z.object({
  refPath: z.array(z.string()).nullable(),
  obj: superFragmentSchema.nullable(),
});

export type SuperStartState = z.infer<typeof superStartStateSchema>;

/**
 * Page-BOTTOM state — a pure reference: the printed path of the page's last
 * entity. No fragment content lives here; the bottom entity's content is in
 * `entities` under its printed path.
 */
export const superEndStateSchema = z.object({
  refPath: z.array(z.string()).nullable(),
});

export type SuperEndState = z.infer<typeof superEndStateSchema>;

/** The state of a page boundary that cuts nothing (fresh labelled start). */
export const EMPTY_PAGE_STATE = {
  refPath: null,
  obj: null,
} satisfies SuperStartState;

const superPageSectionsSchema = z.object({
  label: z.string(),
  /** Printed label chain where the section's question range begins. */
  startPath: z.array(z.string()).optional(),
  /** Printed label chain where the section's question range ends. */
  endPath: z.array(z.string()).optional(),
  /** True when the section's range continues a section from the previous page. */
  continuesPathFromPrevious: z.boolean().optional(),
  eachMarks: z.number().optional(),
});

export const superPageSchema = z.object({
  pageNo: z.number().optional(),
  isRelevant: z.boolean(),
  /** Page TOP: continuation fragment or first-entity path reference. */
  startState: superStartStateSchema,
  /** Page BOTTOM: reference to the page's last entity. */
  endState: superEndStateSchema,
  sections: z.array(superPageSectionsSchema).optional(),
  entities: z.array(superEntitySchema),
});

export type Subject =
  | "maths"
  | "physics"
  | "chemistry"
  | "grammar"
  | "comprehension";
export type ContentWithFigures = z.infer<typeof contentWithFiguresSchema>;
export type RichContent = z.infer<typeof richContentSchema>;
export type SuperOptions = z.infer<typeof superOptionsSchema>;
export type OptionContent = NonNullable<SuperOptions["A"]>;
export type SuperEntity = z.infer<typeof superEntitySchema>;
export type SuperPageSection = z.infer<typeof superPageSectionsSchema>;
export type StructuredPageParseResult = z.infer<typeof superPageSchema>;
/**
 * Alias kept for call-site brevity — the merged two-stage output for a page.
 */
export type StructuredSchemaParseResult = StructuredPageParseResult;

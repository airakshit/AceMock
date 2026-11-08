/**
 * V3 SUPER SCHEMA — the merged production output of the two-stage OCR flow.
 *
 * Shape mirrors ./new-schema (stage 1) but every `hasFigure` boolean is
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
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  subject: z.enum(["math", "physics", "chemistry", "grammar", "comprehension"]).optional(),
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
  passage: z.object({
    text: z.string(),
  }).optional(),
  question: richContentSchema.optional(),
  solution: richContentSchema.optional(),
  options: superOptionsSchema.optional(),
  answerKey: z.enum(["A", "B", "C", "D"]).optional(),
});

const superPageSectionsSchema = z.object({
  label: z.string(),
  start: z.union([z.string(), z.number()]).optional(),
  end: z.union([z.string(), z.number()]).optional(),
  eachMarks: z.number().optional(),
});

export const superPageSchema = z.object({
  pageNo: z.number().optional(),
  isRelevant: z.boolean(),
  isStartOpen: z.boolean(),
  isEndOpen: z.boolean(),
  sections: z.array(superPageSectionsSchema).optional(),
  entities: z.array(superEntitySchema),
});

export type Difficulty = "easy" | "medium" | "hard";
export type Subject = "math" | "physics" | "chemistry" | "grammar" | "comprehension";
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

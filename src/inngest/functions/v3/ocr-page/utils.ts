/**
 * V3 OCR parsing utilities — PATH-BASED two-stage flow.
 *
 * Stage 1 (new-schema pageSchema): text/LaTeX + hasFigure flags per entity.
 * Stage 2 (new-schema stage2RootSchema): bounding boxes keyed by path.
 * mergeStage1AndStage2 produces the ./super-schema shape (0-1 fraction
 * boxes), which is exactly what downstream stitching consumes.
 */
import {
  PartialEntity,
  PartialPageParseResult,
  Stage2BoundingBoxResult,
  Stage2Item,
  pageSchema,
  stage2RootSchema,
} from "./new-schema";
import { OcrMergeError } from "./errors";
import {
  BoundingBox,
  OptionContent,
  StructuredPageParseResult,
  SuperEntity,
  superPageSchema,
} from "./super-schema";
import { pathKey } from "./path-utils";

type PartialOCRParseResult = {
  cleanedText: string | null;
  survivedValidation: boolean;
  parsedStructuredData?: PartialPageParseResult;
  validationErrors?: string[];
  /** Index of the failing entity within `entities[]`, when a Zod error points at it. */
  entityIndex?: number;
};

type Stage2ParseResult = {
  survivedValidation: boolean;
  parsedStructuredData?: Stage2BoundingBoxResult;
  validationErrors?: string[];
  entityIndex?: number;
};

const THINK_TAG = /<think[\s\S]*?<\/think>/gi;
const CODE_FENCE = /```(?:json)?\s*([\s\S]*?)\s*```/i;
const TRAILING_COMMA = /,\s*([\]}])/g;

/**
 * Extracts the entity array index from a Zod issue path like
 * ["entities", "45", "question", "text"] → 45. Returns undefined when no
 * entity-level issue is found.
 */
function extractEntityIndex(
  issues: Array<{ path: unknown[] }>,
): number | undefined {
  for (const issue of issues) {
    const [first, second] = issue.path as unknown[];
    if (first === "entities" && typeof second === "number") {
      return second;
    }
  }
  return undefined;
}

/**
 * Fallback: Pulls the JSON payload out of markdown fences, or the outermost {}.
 * Only needed when structured output is not used or the model wraps its response.
 */
export function extractJsonPayload(text: string): string {
  const fenced = text.match(CODE_FENCE)?.[1];
  if (fenced) return fenced.trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start !== -1 && end > start ? text.slice(start, end + 1).trim() : text;
}

/** Parses JSON, retrying once with trailing commas stripped. */
export function tryParseJson(
  text: string,
): { ok: true; json: unknown; source: string } | { ok: false; error: string } {
  try {
    return { ok: true, json: JSON.parse(text), source: text };
  } catch {
    const sanitized = text.replace(TRAILING_COMMA, "$1");
    try {
      return { ok: true, json: JSON.parse(sanitized), source: sanitized };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error ? err.message : "Failed to parse JSON string.",
      };
    }
  }
}

/**
 * Recursively converts `null` values to `undefined` so downstream code
 * using optional chaining (`?.`) works seamlessly with structured output
 * responses (whose schema expresses optionality with nullable types).
 */
export function nullsToUndefined<T>(obj: T): T {
  if (obj === null) return undefined as unknown as T;
  if (Array.isArray(obj)) return obj.map(nullsToUndefined) as unknown as T;
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== null) {
        result[key] = nullsToUndefined(value);
      }
      // null values are simply omitted -> become undefined on access
    }
    return result as T;
  }
  return obj;
}

/**
 * Recursively repairs LaTeX strings where single backslashes in JSON output
 * were parsed as JSON escape sequences (e.g. tab, form feed, backspace).
 */
export function sanitizeLatexString(val: unknown): unknown {
  if (typeof val !== "string") return val;
  return val
    .replace(/\t([a-zA-Z])/g, "\\t$1")
    .replace(/\x0c([a-zA-Z])/g, "\\f$1")
    .replace(/\x08([a-zA-Z])/g, "\\b$1")
    .replace(/\r([a-zA-Z])/g, "\\r$1")
    .replace(
      /\n(eq|e|abla|atural|eg|i|otin|ot|u|exists|rightarrow|leftarrow|Rightarrow|Leftarrow|mid|parallel|subset|subseteq|supset|supseteq|cong|sim)\b/g,
      "\\n$1",
    )
    .replace(/(^|[^\\])\bext\{/g, "$1\\text{");
}

/**
 * V3 stage-1 normalization. Deliberately LIGHT — numeric/boolean/path
 * coercions live in the Zod schema (ported from v2's preprocess pipeline);
 * this pass only sanitizes LaTeX-ish `text` values.
 */
function normalizePartialPage(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const root = { ...(raw as Record<string, unknown>) };

  if (Array.isArray(root.sections)) {
    root.sections = root.sections.map((section) => {
      if (!section || typeof section !== "object" || Array.isArray(section)) {
        return section;
      }
      const clean = { ...(section as Record<string, unknown>) };
      if (typeof clean.label !== "string") {
        clean.label = String(clean.label ?? "");
      }
      return clean;
    });
  }

  if (Array.isArray(root.entities)) {
    root.entities = root.entities.map(normalizePartialEntity);
  }

  return root;
}

function normalizePartialEntity(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const entity = { ...(raw as Record<string, unknown>) };

  if (entity.question || entity.solution) {
    for (const field of ["question", "solution"] as const) {
      if (!entity[field] || typeof entity[field] !== "object") continue;
      const content = {
        ...(entity[field] as Record<string, unknown>),
      };
      if (typeof content.text === "string") {
        content.text = sanitizeLatexString(content.text);
      }
      entity[field] = content;
    }
  }

  if (entity.passage && typeof entity.passage === "object") {
    const passage = { ...(entity.passage as Record<string, unknown>) };
    if (typeof passage.text === "string") {
      passage.text = sanitizeLatexString(passage.text);
    }
    entity.passage = passage;
  }

  if (entity.options && typeof entity.options === "object") {
    const options: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(
      entity.options as Record<string, unknown>,
    )) {
      if (!val || typeof val !== "object" || Array.isArray(val)) {
        options[key] = val;
        continue;
      }
      const option = { ...(val as Record<string, unknown>) };
      if (typeof option.text === "string") {
        option.text = sanitizeLatexString(option.text);
      }
      options[key] = option;
    }
    entity.options = options;
  }

  return entity;
}

/**
 * Parses stage-1 raw LLM response against the v3 partial page schema
 * (path text/LaTeX extraction + hasFigure flags, no bounding boxes).
 */
export function parsePartialStructuredOCR(
  rawText: string | null,
): PartialOCRParseResult {
  if (!rawText?.trim()) {
    return {
      cleanedText: null,
      survivedValidation: false,
      validationErrors: ["Empty LLM response received for stage 1."],
    };
  }

  const trimmed = rawText.trim();
  let parsed = tryParseJson(trimmed);

  if (!parsed.ok) {
    const withoutThinking = trimmed.replace(THINK_TAG, "").trim();
    const jsonPayload = extractJsonPayload(withoutThinking);
    parsed = tryParseJson(jsonPayload);
  }

  if (!parsed.ok) {
    return {
      cleanedText: trimmed,
      survivedValidation: false,
      validationErrors: [parsed.error],
    };
  }

  const cleaned = nullsToUndefined(parsed.json);
  const normalized = normalizePartialPage(cleaned);

  const result = pageSchema.safeParse(normalized);
  if (!result.success) {
    const validationErrors = result.error.issues.map(
      (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
    );
    return {
      cleanedText: parsed.source,
      survivedValidation: false,
      validationErrors,
      entityIndex: extractEntityIndex(result.error.issues),
    };
  }

  // `entities` may be null (irrelevant page) downstream everywhere expects an
  // array — collapse once, here.
  const parsedData: PartialPageParseResult = {
    ...result.data,
    entities: result.data.entities ?? [],
  };

  return {
    cleanedText: parsed.source,
    survivedValidation: true,
    parsedStructuredData: parsedData,
  };
}

// ---------------------------------------------------------------------------
// Stage 2 parsing + scale repair
// ---------------------------------------------------------------------------

const BOX_COORD_KEYS = ["xMin", "xMax", "yMin", "yMax"] as const;

/** Parses a coordinate value (number or numeric string), or null when malformed. */
function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Returns the box's four coordinates as numbers, or null when not a well-formed box. */
function readBoxCoords(box: unknown): number[] | null {
  if (!box || typeof box !== "object") return null;
  const coords: number[] = [];
  for (const key of BOX_COORD_KEYS) {
    const parsed = toFiniteNumber((box as Record<string, unknown>)[key]);
    if (parsed === null) return null;
    coords.push(parsed);
  }
  return coords;
}

/**
 * Native Gemini grounding mode: the provider schema requests integer
 * bounding-box coordinates in the 0-1000 range. When EVERY box in the
 * stage-2 response holds integers within [0, 1000] (with at least one value
 * above 1), the response is confidently on the native scale — rescale
 * everything to 0-1 fractions deterministically. Resolving scale PAGE-WIDE
 * (not per box) is what disambiguates small boxes sitting in the top-left
 * corner. Fractional 0-1 fallbacks and percent output are handled by the
 * per-item repair below.
 */
function rescaleNativeGroundingBoxes(items: Stage2Item[]): void {
  const boxes: Record<string, unknown>[] = [];
  for (const item of items) {
    boxes.push(...collectStage2Boxes(item));
  }
  if (boxes.length === 0) return;

  let allNative = true;
  let anyAboveOne = false;
  outer: for (const box of boxes) {
    for (const key of BOX_COORD_KEYS) {
      const value = toFiniteNumber(box[key]);
      if (
        value === null ||
        value < 0 ||
        value > 1000 ||
        !Number.isInteger(value)
      ) {
        allNative = false;
        break outer;
      }
      if (value > 1) anyAboveOne = true;
    }
  }

  if (!allNative || !anyAboveOne) return;

  for (const box of boxes) {
    for (const key of BOX_COORD_KEYS) {
      const value = toFiniteNumber(box[key]);
      if (value !== null) {
        // Round to avoid float noise from the division.
        box[key] = Number((value / 1000).toFixed(6));
      }
    }
  }
  console.warn(
    `[v3-ocr] Native 0-1000 grounding detected (${boxes.length} box(es)); rescaled to 0-1 fractions.`,
  );
}

/** Collects every raw stage-2 box of one item as mutable records. */
function collectStage2Boxes(item: Stage2Item): Record<string, unknown>[] {
  const boxes: Record<string, unknown>[] = [];
  for (const figure of item.questionFigures ?? []) {
    if (figure && typeof figure === "object") {
      boxes.push(figure as unknown as Record<string, unknown>);
    }
  }
  for (const figure of item.solutionFigures ?? []) {
    if (figure && typeof figure === "object") {
      boxes.push(figure as unknown as Record<string, unknown>);
    }
  }
  for (const option of Object.values(item.optionFigures ?? {})) {
    if (option && typeof option === "object") {
      boxes.push(option as unknown as Record<string, unknown>);
    }
  }
  return boxes;
}

/** True when the box is already on the 0-1 scale (all coords <= 1.5). */
function looksUnitScale(coords: number[]): boolean {
  return coords.every((value) => value <= 1.5);
}

/**
 * Parses stage-2 raw LLM response against the path-keyed bounding box
 * schema. 0-1000 native integers stay as-is; the merge rescales them.
 */
export function parseStage2BoundingBoxes(
  rawText: string | null,
): Stage2ParseResult {
  if (!rawText?.trim()) {
    return {
      survivedValidation: false,
      validationErrors: ["Empty LLM response received for stage 2."],
    };
  }

  const trimmed = rawText.trim();
  let parsed = tryParseJson(trimmed);

  if (!parsed.ok) {
    const withoutThinking = trimmed.replace(THINK_TAG, "").trim();
    const jsonPayload = extractJsonPayload(withoutThinking);
    parsed = tryParseJson(jsonPayload);
  }

  if (!parsed.ok) {
    return {
      survivedValidation: false,
      validationErrors: [parsed.error],
    };
  }

  const cleaned = nullsToUndefined(parsed.json);
  const result = stage2RootSchema.safeParse(cleaned);
  if (!result.success) {
    const validationErrors = result.error.issues.map(
      (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
    );
    return {
      survivedValidation: false,
      validationErrors,
      entityIndex: extractEntityIndex(result.error.issues),
    };
  }

  const parsedData: Stage2BoundingBoxResult = {
    ...result.data,
    items: result.data.items ?? [],
  };

  // Deterministic native-scale rescale happens HERE (page-wide) so the
  // merge only ever sees 0-1 fractions; the per-item heuristic below only
  // runs when the native detection did not apply (stray percent outputs).
  rescaleNativeGroundingBoxes(parsedData.items);

  if (!nativeScaleApplied(parsedData.items)) {
    for (const item of parsedData.items) {
      repairStage2ItemScale(item);
    }
  }

  return {
    survivedValidation: true,
    parsedStructuredData: parsedData,
  };
}

/** Detects whether the whole stage-2 response was already on the 0-1 scale. */
function nativeScaleApplied(items: Stage2Item[]): boolean {
  const boxes = items.flatMap(collectStage2Boxes);
  if (boxes.length === 0) return false;
  return boxes.every((box) => {
    const coords = readBoxCoords(box);
    return coords !== null && looksUnitScale(coords);
  });
}

/**
 * Fallback repair for stage-2 responses that ignored the native scale:
 * any item whose max coordinate exceeds 100 is treated as 0-1000, any
 * max above 1.5 as 0-100 percent.
 */
function repairStage2ItemScale(item: Stage2Item): void {
  const boxes = collectStage2Boxes(item);
  if (boxes.length === 0) return;

  let maxCoord = 0;
  for (const box of boxes) {
    const coords = readBoxCoords(box);
    if (!coords) continue;
    for (const value of coords) maxCoord = Math.max(maxCoord, value);
  }

  let divideBy: number;
  if (maxCoord > 100) {
    divideBy = 1000;
  } else if (maxCoord > 1.5) {
    divideBy = 100;
  } else {
    return; // Already on the 0-1 scale.
  }

  for (const box of boxes) {
    for (const key of BOX_COORD_KEYS) {
      const value = toFiniteNumber(box[key]);
      if (value !== null) {
        box[key] = Number((value / divideBy).toFixed(6));
      }
    }
  }
  console.warn(
    `[v3-ocr] Stage-2 boxes look like a 0-${divideBy === 1000 ? "1000" : "100"} scale; rescaled by 1/${divideBy}. Box sample: ${JSON.stringify(boxes[0])}`,
  );
}

/**
 * Describes a figure target per ENTITY for stage 2. One entry per entity
 * (path) that reported hasFigure=true. `path: null` = the unlabeled
 * continuation entity; ambiguity when several such entities exist must be
 * resolved BEFORE stage 2 (see resolveUnlabeledTargets).
 */
export interface FigureTarget {
  /** Verbatim printed path, or null for the unlabeled continuation entity. */
  path: string[] | null;
  needs: {
    question: boolean;
    solution: boolean;
    options: Array<"A" | "B" | "C" | "D">;
  };
}

/**
 * Collects the per-entity figure targets stage 2 must locate, derived from
 * a stage-1 result. Entities without a printed path all share the one
 * unlabeled slot ("[]") — more than ONE such entity with figures cannot be
 * disambiguated by stage 2, so that situation is a hard OcrMergeError.
 */
export function collectFigureTargets(
  stage1: PartialPageParseResult,
): FigureTarget[] {
  const UNLABELED = "[]";
  const byKey = new Map<string, FigureTarget>();
  let unlabeledEntityCount = 0;

  for (const entity of stage1.entities) {
    const needs: FigureTarget["needs"] = {
      question: false,
      solution: false,
      options: [],
    };

    if (entity.question?.hasFigure) needs.question = true;
    if (entity.solution?.hasFigure) needs.solution = true;
    if (entity.options) {
      for (const key of ["A", "B", "C", "D"] as const) {
        if (entity.options[key]?.hasFigure) needs.options.push(key);
      }
    }

    const anyNeeded = needs.question || needs.solution || needs.options.length > 0;
    if (!anyNeeded) continue;

    const key = pathKey(entity.path);
    if (key === UNLABELED) unlabeledEntityCount += 1;

    const existing = byKey.get(key);
    if (existing) {
      // Content printed together on one entity — merge needs.
      existing.needs.question ||= needs.question;
      existing.needs.solution ||= needs.solution;
      for (const option of needs.options) {
        if (!existing.needs.options.includes(option)) {
          existing.needs.options.push(option);
        }
      }
    } else {
      byKey.set(key, {
        path: key === UNLABELED ? null : entity.path ?? null,
        needs,
      });
    }
  }

  // Two DIFFERENT unlabeled figure-bearing entities cannot be addressed —
  // surface the ambiguity to the caller rather than emitting one merged
  // target that stage 2 could never disambiguate.
  if (unlabeledEntityCount > 1) {
    throw new OcrMergeError(
      `Stage-1 reported ${unlabeledEntityCount} unlabeled (continuation) entities with figures; stage 2 cannot disambiguate them.`,
    );
  }

  return [...byKey.values()];
}

/** True when any entity on the page reports hasFigure=true. */
export function pageHasFigures(stage1: PartialPageParseResult): boolean {
  return collectFigureTargets(stage1).length > 0;
}

// ---------------------------------------------------------------------------
// Stage-1 / Stage-2 MERGE
// ---------------------------------------------------------------------------

/**
 * The stage-2 parser has already normalized every box to a 0-1 fraction
 * (native page-wide rescale or per-item repair). This is a pure copy.
 */
function asBoundingBox(box: Stage2Item["questionFigures"][number]): BoundingBox | null {
  if (
    !box ||
    typeof box !== "object" ||
    typeof box.xMin !== "number" ||
    typeof box.yMin !== "number" ||
    typeof box.xMax !== "number" ||
    typeof box.yMax !== "number"
  ) {
    return null;
  }
  return {
    xMin: box.xMin,
    yMin: box.yMin,
    xMax: box.xMax,
    yMax: box.yMax,
  };
}

function toBoundingBoxes(
  boxes: Array<{ xMin: number; yMin: number; xMax: number; yMax: number }> | undefined,
): BoundingBox[] {
  if (!boxes?.length) return [];
  return boxes
    .map((box) => asBoundingBox(box))
    .filter((box): box is BoundingBox => box !== null);
}

/**
 * Merges stage-1 text extraction with stage-2 bounding box extraction into
 * the super-schema shape.
 *
 * STRICT MERGE RULES (all violations throw OcrMergeError and are treated as
 * non-retriable by the caller):
 *  1. Duplicate path in stage-2 items → OcrMergeError
 *  2. More than one unlabeled (null-path) stage-2 item → OcrMergeError
 *  3. Stage-2 item whose path is not requested by stage 1 → OcrMergeError
 *  4. Stage-1 entity with hasFigure=true but no matching stage-2 figures → OcrMergeError
 *  5. Stage-2 reports figures for a field stage 1 marked hasFigure=false → OcrMergeError
 *  6. Stage-1 entities WITHOUT path (continuation) must map to the single
 *     unlabeled stage-2 item; >1 such stage-1 entity → OcrMergeError
 *
 * Boxes arrive as 0-1 fractions (native rescale already applied in the
 * stage-2 parser) — nothing is rescaled here.
 */
export function mergeStage1AndStage2(
  stage1: PartialPageParseResult,
  stage2: Stage2BoundingBoxResult,
): StructuredPageParseResult {
  const stage2Map = new Map<string, Stage2Item>();
  for (const item of stage2.items ?? []) {
    const key = pathKey(item.path);
    if (stage2Map.has(key)) {
      throw new OcrMergeError(
        `Duplicate stage-2 entry for path ${key === "[]" ? "<unlabeled>" : JSON.stringify(item.path ?? [])}.`,
      );
    }
    stage2Map.set(key, item);
  }

  const requestedKeys = new Set(stage2Map.keys());
  let unlabeledStage1Consumed = false;

  const stage1FigureKeys = new Set<string>();
  for (const entity of stage1.entities) {
    const hasAnyFigure =
      !!entity.question?.hasFigure ||
      !!entity.solution?.hasFigure ||
      (!!entity.options &&
        (["A", "B", "C", "D"] as const).some(
          (k) => entity.options![k]?.hasFigure,
        ));
    if (!hasAnyFigure) continue;
    stage1FigureKeys.add(pathKey(entity.path));
  }

  // Rule 3: every stage-2 key must correspond to a stage-1 figure target.
  for (const key of requestedKeys) {
    if (!stage1FigureKeys.has(key)) {
      throw new OcrMergeError(
        `Stage-2 reported bounding boxes for ${key === "[]" ? "<unlabeled>" : `path ${key}`} but stage 1 requested no figures there.`,
      );
    }
  }

  const takeStage2 = (entity: PartialEntity): Stage2Item | undefined => {
    const key = pathKey(entity.path);
    if (key === "[]") {
      if (unlabeledStage1Consumed && requestedKeys.has("[]")) {
        throw new OcrMergeError(
          "Multiple unlabeled (continuation) entities with figures in stage 1; stage 2 cannot disambiguate.",
        );
      }
      unlabeledStage1Consumed = true;
    }
    return stage2Map.get(key);
  };

  const mergeContent = (
    content: PartialEntity["question"],
    stage2Item: Stage2Item | undefined,
    field: "question" | "solution",
    entityPath: string[] | undefined,
  ): SuperEntity["question"] | undefined => {
    if (!content) {
      if (stage2Item) {
        const stage2Figures =
          field === "question"
            ? stage2Item.questionFigures
            : stage2Item.solutionFigures;
        if (stage2Figures?.length) {
          throw new OcrMergeError(
            `${field} figures reported for ${describeEntityPath(entityPath)} but stage 1 has no ${field}.`,
          );
        }
      }
      return undefined;
    }

    if (content.hasFigure) {
      const stage2Figures =
        field === "question"
          ? stage2Item?.questionFigures
          : stage2Item?.solutionFigures;
      if (!stage2Figures?.length) {
        throw new OcrMergeError(
          `${field}.hasFigure=true for ${describeEntityPath(entityPath)} but no ${field}Figures in stage-2 output.`,
        );
      }
      return {
        text: content.text,
        figures: toBoundingBoxes(stage2Figures),
        marks: content.marks,
        difficulty: content.difficulty,
        subject: content.subject,
        isStandalone: content.isStandalone,
        answerValue: content.answerValue,
      };
    }

    const stage2Figures =
      field === "question"
        ? stage2Item?.questionFigures
        : stage2Item?.solutionFigures;
    if (stage2Figures?.length) {
      throw new OcrMergeError(
        `${field}.hasFigure=false for ${describeEntityPath(entityPath)} but stage-2 reports figures.`,
      );
    }

    return {
      text: content.text,
      figures: [],
      marks: content.marks,
      difficulty: content.difficulty,
      subject: content.subject,
      isStandalone: content.isStandalone,
      answerValue: content.answerValue,
    };
  };

  const mergeOptions = (
    options: PartialEntity["options"],
    stage2Item: Stage2Item | undefined,
  ): StructuredPageParseResult["entities"][number]["options"] => {
    if (!options) {
      const hasOrphanFigure = stage2Item?.optionFigures
        ? Object.values(stage2Item.optionFigures).some(Boolean)
        : false;
      if (hasOrphanFigure) {
        throw new OcrMergeError(
          "Stage-2 reported option figures but stage 1 has no options on this entity.",
        );
      }
      return undefined;
    }

    const mergedOptions: Record<string, OptionContent> = {};
    for (const key of ["A", "B", "C", "D"] as const) {
      const option = options[key];
      if (!option) {
        // Option exists nowhere in stage 1 — stage 2 must not report one.
        if (stage2Item?.optionFigures?.[key]) {
          throw new OcrMergeError(
            `Option ${key} figure reported in stage 2 but stage 1 has no such option.`,
          );
        }
        continue;
      }
      if (option.hasFigure) {
        const stage2Figure = stage2Item?.optionFigures?.[key];
        if (!stage2Figure) {
          throw new OcrMergeError(
            `Option ${key}.hasFigure=true but no figure in stage-2 optionFigures.`,
          );
        }
        const figure = asBoundingBox(stage2Figure);
        mergedOptions[key] = figure
          ? { text: option.text, figure }
          : { text: option.text };
      } else {
        if (stage2Item?.optionFigures?.[key]) {
          throw new OcrMergeError(
            `Option ${key}.hasFigure=false but stage-2 reports a figure.`,
          );
        }
        mergedOptions[key] = { text: option.text };
      }
    }
    return Object.keys(mergedOptions).length > 0 ? mergedOptions : undefined;
  };

  const mergedEntities: SuperEntity[] = stage1.entities.map((entity) => {
    const stage2Item = takeStage2(entity);

    const question = mergeContent(
      entity.question,
      stage2Item,
      "question",
      entity.path,
    );
    const solution = mergeContent(
      entity.solution,
      stage2Item,
      "solution",
      entity.path,
    );
    const options = mergeOptions(entity.options, stage2Item);

    return {
      path: entity.path,
      passage: entity.passage,
      question,
      solution,
      options,
      answerKey: entity.answerKey,
    };
  });

  return {
    pageNo: stage1.pageNo,
    isRelevant: stage1.isRelevant,
    isStartOpen: stage1.isStartOpen,
    isEndOpen: stage1.isEndOpen,
    sections: stage1.sections,
    entities: mergedEntities,
  };
}

function describeEntityPath(path: string[] | undefined): string {
  return path && path.length > 0
    ? `path ${JSON.stringify(path)}`
    : "the unlabeled continuation entity";
}

import {
  PartialSchemaParseResult,
  Stage2BoundingBox,
  Stage2BoundingBoxResult,
  Stage2Item,
  Stage2OptionFigures,
  partialOCRExtractionSchema,
  stage2BoundingBoxSchemaRoot,
} from "./partial-schema";
import { OcrMergeError } from "./errors";
import {
  BoundingBox,
  OptionContent,
  QuestionData,
  StructuredSchemaParseResult,
  TextAndFigures,
  structuredOCRExtractionSchema,
} from "./structured-question-schema";

type StructuredOCRParseResult = {
  cleanedText: string | null;
  survivedValidation: boolean;
  parsedStructuredData?: StructuredSchemaParseResult;
  validationErrors?: string[];
};

type PartialOCRParseResult = {
  cleanedText: string | null;
  survivedValidation: boolean;
  parsedStructuredData?: PartialSchemaParseResult;
  validationErrors?: string[];
};

const THINK_TAG = /<think>[\s\S]*?<\/think>/gi;
const CODE_FENCE = /```(?:json)?\s*([\s\S]*?)\s*```/i;
const TRAILING_COMMA = /,\s*([\]}])/g;

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
 * Exported for the debug harness, which uses it on its own parse path.
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
function sanitizeLatexString(val: unknown): unknown {
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
 * Coerces raw figure-ish values (object | array) into an array of bounding boxes.
 */
function asFigureArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
}

/**
 * Normalizes a question/solution content value into { text, figures }:
 * - legacy (v1) plain-string content becomes { text }
 * - a `figure` (singular) value merges into the `figures` array
 * - legacy flat figure arrays (questionFigures / solutionFigures) merge in
 */
function normalizeContentShape(raw: unknown, legacyFigures: unknown): unknown {
  if (typeof raw === "string") {
    return {
      text: sanitizeLatexString(raw),
      figures: asFigureArray(legacyFigures),
    };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;

  const content: Record<string, unknown> = {
    ...(raw as Record<string, unknown>),
  };
  const extra = asFigureArray(legacyFigures);

  if (content.figure !== undefined) {
    content.figures = [...asFigureArray(content.figure), ...extra];
    delete content.figure;
  } else {
    content.figures = [...asFigureArray(content.figures), ...extra];
  }

  if (typeof content.text === "string") {
    content.text = sanitizeLatexString(content.text);
  }
  return content;
}

/**
 * Normalizes the options object:
 * - legacy (v1) plain-string options become { text }
 * - a plural `figures` value collapses to its first box as singular `figure`
 * - the legacy `optionFigures` map fills missing per-option boxes
 */
function normalizeOptionsShape(
  raw: unknown,
  legacyOptionFigures: unknown,
): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;

  const legacyMap =
    legacyOptionFigures &&
    typeof legacyOptionFigures === "object" &&
    !Array.isArray(legacyOptionFigures)
      ? (legacyOptionFigures as Record<string, unknown>)
      : {};

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof val === "string") {
      result[key] = { text: sanitizeLatexString(val) };
      continue;
    }
    if (!val || typeof val !== "object" || Array.isArray(val)) {
      result[key] = val;
      continue;
    }

    const content: Record<string, unknown> = {
      ...(val as Record<string, unknown>),
    };
    if (content.figures !== undefined) {
      if (content.figure === undefined) {
        content.figure = asFigureArray(content.figures)[0];
      }
      delete content.figures;
    }
    if (Array.isArray(content.figure)) {
      content.figure = content.figure[0];
    }
    if (typeof content.text === "string") {
      content.text = sanitizeLatexString(content.text);
    }
    result[key] = content;
  }

  for (const [key, box] of Object.entries(legacyMap)) {
    const existing = result[key];
    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
      const option = existing as Record<string, unknown>;
      if (option.figure === undefined) option.figure = box;
    } else if (existing === null || existing === undefined) {
      result[key] = { figure: box };
    }
  }

  return result;
}

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
 * Repairs bounding boxes emitted on a non-normalized coordinate scale.
 *
 * The schema and prompt request 0-1 fractions, but models habitually fall
 * back to other conventions — the 0-1000 integer grounding scale that
 * Gemini-family models are trained on, or 0-100 percent coordinates —
 * typically when provider-side schema enforcement is missing or ignored.
 * Left unrepaired, such values clamp to page edges and produce blank or
 * wildly misplaced crops.
 *
 * Detection is per item: if any single coordinate exceeds 100 the item is
 * treated as 0-1000 scaled (all its boxes rescaled), otherwise any
 * coordinate above 1.5 marks the 0-100 percent scale. Boxes already on the
 * 0-1 scale are left untouched.
 */
function repairFigureCoordinateScales(cleanItem: Record<string, unknown>): void {
  // Collect every bounding box attached to this item.
  const boxes: Record<string, unknown>[] = [];
  const collectFromContent = (content: unknown) => {
    if (!content || typeof content !== "object") return;
    const figures = (content as Record<string, unknown>).figures;
    if (Array.isArray(figures)) {
      for (const figure of figures) {
        if (figure && typeof figure === "object") {
          boxes.push(figure as Record<string, unknown>);
        }
      }
    }
  };
  collectFromContent(cleanItem.question);
  collectFromContent(cleanItem.solution);
  if (cleanItem.options && typeof cleanItem.options === "object") {
    for (const option of Object.values(cleanItem.options as Record<string, unknown>)) {
      if (!option || typeof option !== "object") continue;
      const figure = (option as Record<string, unknown>).figure;
      if (figure && typeof figure === "object") {
        boxes.push(figure as Record<string, unknown>);
      }
    }
  }

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

  let rescaled = 0;
  for (const box of boxes) {
    const coords = readBoxCoords(box);
    if (!coords) continue;
    for (const key of BOX_COORD_KEYS) {
      const value = toFiniteNumber(box[key]);
      if (value !== null) {
        // Round to avoid float noise from the division (e.g. 8.2/100).
        box[key] = Number((value / divideBy).toFixed(6));
      }
    }
    rescaled++;
  }
  console.warn(
    `[normalizeStructuredOCR] Bounding-box coordinates for serial ${String(cleanItem.serialNo ?? "?")} ` +
      `look like a 0-${divideBy === 1000 ? "1000" : "100"} scale; rescaled by 1/${divideBy}. ` +
      `Box sample: ${JSON.stringify(boxes[0])}`,
  );
}

/**
 * Native Gemini grounding mode: the provider schema requests integer
 * bounding-box coordinates in the 0-1000 range. When EVERY box on the page
 * holds integers within [0, 1000] (with at least one value above 1), the
 * response is confidently on the native scale — rescale everything to 0-1
 * fractions deterministically. Resolving scale PAGE-WIDE (not per box) is
 * what disambiguates small boxes sitting in the top-left corner, which a
 * per-box max-value heuristic cannot classify. Responses that are not
 * clearly native (fractional 0-1 fallbacks, percent output) fall through to
 * repairFigureCoordinateScales instead.
 */
function rescaleNativeGroundingBoxes(root: Record<string, unknown>): void {
  const data = root.data;
  if (!Array.isArray(data)) return;
  const items = data as unknown[];

  const boxes: Record<string, unknown>[] = [];
  const collectFigures = (content: unknown) => {
    if (!content || typeof content !== "object") return;
    const figures = (content as Record<string, unknown>).figures;
    if (Array.isArray(figures)) {
      for (const figure of figures) {
        if (figure && typeof figure === "object") {
          boxes.push(figure as Record<string, unknown>);
        }
      }
    }
  };
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const cleanItem = item as Record<string, unknown>;
    collectFigures(cleanItem.question);
    collectFigures(cleanItem.solution);
    if (cleanItem.options && typeof cleanItem.options === "object") {
      for (const option of Object.values(
        cleanItem.options as Record<string, unknown>,
      )) {
        if (!option || typeof option !== "object") continue;
        const figure = (option as Record<string, unknown>).figure;
        if (figure && typeof figure === "object") {
          boxes.push(figure as Record<string, unknown>);
        }
      }
    }
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
    `[normalizeStructuredOCR] Native 0-1000 grounding detected (${boxes.length} box(es)); rescaled to 0-1 fractions.`,
  );
}

/**
 * Stage-1 (partial schema) content sanitizer: text + hasFigure only.
 * Deliberately does NOT inject a `figures` array (the partial schema is
 * strict and has no figures key). Handles legacy plain-string content too.
 */
function sanitizePartialContentShape(raw: unknown): unknown {
  if (typeof raw === "string") {
    return { text: sanitizeLatexString(raw), hasFigure: false };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;

  const content: Record<string, unknown> = {
    ...(raw as Record<string, unknown>),
  };
  delete content.figure;
  delete content.figures;
  if (typeof content.text === "string") {
    content.text = sanitizeLatexString(content.text);
  }
  if (content.hasFigure === undefined) content.hasFigure = false;
  return content;
}

/**
 * Stage-1 (partial schema) options sanitizer: text + hasFigure only.
 */
function sanitizePartialOptionsShape(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof val === "string") {
      result[key] = { text: sanitizeLatexString(val), hasFigure: false };
      continue;
    }
    if (!val || typeof val !== "object" || Array.isArray(val)) {
      result[key] = val;
      continue;
    }
    const content: Record<string, unknown> = {
      ...(val as Record<string, unknown>),
    };
    delete content.figure;
    delete content.figures;
    if (typeof content.text === "string") {
      content.text = sanitizeLatexString(content.text);
    }
    if (content.hasFigure === undefined) content.hasFigure = false;
    result[key] = content;
  }
  return result;
}

/**
 * Normalizes common LLM structural mistakes:
 * 1. Hoists page-level fields (englishParagraph, sectionLabel, sectionStart,
 *    sectionEnd, eachMarks) from items inside `data` to root when root lacks them.
 * 2. Maps the legacy root/item `paragraph` key onto `englishParagraph`.
 * 3. Normalizes root aliases (e.g. `sectionEnds` -> `sectionEnd`, root `marks` -> `eachMarks`).
 * 4. Coerces legacy (v1) flat content shapes (string question/options, sibling
 *    `questionFigures` / `optionFigures` keys) into the v2 nested shape, and
 *    reconciles singular `figure` vs plural `figures` keys per field.
 * 5. Native Gemini 0-1000 grounding: page-wide deterministic /1000 rescale,
 *    then the per-item scale heuristic for stray fallback outputs.
 */
function normalizeStructuredOCR(
  raw: unknown,
  options?: { includeFigures?: boolean },
): unknown {
  const includeFigures = options?.includeFigures ?? true;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const root = { ...(raw as Record<string, unknown>) };

  // Fix common root field misnomers from LLMs:
  if (root.sectionEnds !== undefined && root.sectionEnd === undefined) {
    root.sectionEnd = root.sectionEnds;
    delete root.sectionEnds;
  }
  if (root.marks !== undefined && root.eachMarks === undefined) {
    root.eachMarks = root.marks;
    delete root.marks;
  }
  // v2 renamed the root `paragraph` key; accept both spellings.
  if (
    typeof root.paragraph === "string" &&
    typeof root.englishParagraph !== "string"
  ) {
    root.englishParagraph = sanitizeLatexString(root.paragraph);
  }
  delete root.paragraph;

  // If items in the data array carry page-level fields, hoist to root and strip.
  if (Array.isArray(root.data)) {
    root.data = root.data.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return item;
      const cleanItem = { ...(item as Record<string, unknown>) };

      if (
        typeof cleanItem.paragraph === "string" &&
        typeof root.englishParagraph !== "string"
      ) {
        root.englishParagraph = sanitizeLatexString(cleanItem.paragraph);
      }
      delete cleanItem.paragraph;

      if (
        typeof cleanItem.sectionLabel === "string" &&
        root.sectionLabel === undefined
      ) {
        root.sectionLabel = cleanItem.sectionLabel;
      }
      delete cleanItem.sectionLabel;

      if (cleanItem.sectionStart !== undefined && root.sectionStart === undefined) {
        root.sectionStart = cleanItem.sectionStart;
      }
      delete cleanItem.sectionStart;

      if (cleanItem.sectionEnd !== undefined && root.sectionEnd === undefined) {
        root.sectionEnd = cleanItem.sectionEnd;
      }
      delete cleanItem.sectionEnd;

      if (cleanItem.sectionEnds !== undefined && root.sectionEnd === undefined) {
        root.sectionEnd = cleanItem.sectionEnds;
      }
      delete cleanItem.sectionEnds;

      if (cleanItem.eachMarks !== undefined && root.eachMarks === undefined) {
        root.eachMarks = cleanItem.eachMarks;
      }
      delete cleanItem.eachMarks;

      cleanItem.question = includeFigures
        ? normalizeContentShape(cleanItem.question, cleanItem.questionFigures)
        : sanitizePartialContentShape(cleanItem.question);
      delete cleanItem.questionFigures;

      cleanItem.solution = includeFigures
        ? normalizeContentShape(cleanItem.solution, cleanItem.solutionFigures)
        : sanitizePartialContentShape(cleanItem.solution);
      delete cleanItem.solutionFigures;

      cleanItem.options = includeFigures
        ? normalizeOptionsShape(cleanItem.options, cleanItem.optionFigures)
        : sanitizePartialOptionsShape(cleanItem.options);
      delete cleanItem.optionFigures;

      return cleanItem;
    });

    if (includeFigures) {
      // Native 0-1000 grounding rescale FIRST (page-wide, deterministic); the
      // per-item heuristic below only handles leftovers it cannot classify.
      rescaleNativeGroundingBoxes(root);

      // Detect & repair stray non-native scales (percent / 0-1 fallbacks).
      const items = root.data;
      if (Array.isArray(items)) {
        for (const item of items) {
          if (!item || typeof item !== "object" || Array.isArray(item)) continue;
          repairFigureCoordinateScales(item as Record<string, unknown>);
        }
      }
    }
  }

  return root;
}

/**
 * Parses stage-1 raw LLM response against the partial OCR schema
 * (text/LaTeX + hasFigure flags, no bounding boxes).
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
  const normalized = normalizeStructuredOCR(cleaned, {
    includeFigures: false,
  });

  const result = partialOCRExtractionSchema.safeParse(normalized);
  if (!result.success) {
    return {
      cleanedText: parsed.source,
      survivedValidation: false,
      validationErrors: result.error.issues.map(
        (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
      ),
    };
  }

  return {
    cleanedText: parsed.source,
    survivedValidation: true,
    parsedStructuredData: result.data,
  };
}

/**
 * Parses stage-2 raw LLM response against the bounding box schema.
 * Coordinates arrive as 0-1000 integers and stay that way until the merge
 * step divides by 1000 to produce 0-1 fractions.
 */
export function parseStage2BoundingBoxes(
  rawText: string | null,
): { survivedValidation: boolean; parsedStructuredData?: Stage2BoundingBoxResult; validationErrors?: string[] } {
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
  const result = stage2BoundingBoxSchemaRoot.safeParse(cleaned);
  if (!result.success) {
    return {
      survivedValidation: false,
      validationErrors: result.error.issues.map(
        (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
      ),
    };
  }

  return {
    survivedValidation: true,
    parsedStructuredData: result.data,
  };
}

/**
 * Collects the figures that stage 2 must locate, derived from a stage-1
 * result. An item is included only when it reports hasFigure=true on its
 * question, solution, or any option.
 */
export function collectFiguresToExtract(
  stage1: PartialSchemaParseResult,
): Array<{
  serialNo: number;
  kind: "question" | "solution" | "option";
  index: number | string;
}> {
  const figures: Array<{
    serialNo: number;
    kind: "question" | "solution" | "option";
    index: number | string;
  }> = [];

  for (const item of stage1.data ?? []) {
    if (item.question?.hasFigure) {
      figures.push({ serialNo: item.serialNo, kind: "question", index: 0 });
    }
    if (item.solution?.hasFigure) {
      figures.push({ serialNo: item.serialNo, kind: "solution", index: 0 });
    }
    if (item.options) {
      for (const key of ["A", "B", "C", "D"] as const) {
        if (item.options[key]?.hasFigure) {
          figures.push({ serialNo: item.serialNo, kind: "option", index: key });
        }
      }
    }
  }

  return figures;
}

/**
 * Merges stage-1 text extraction with stage-2 bounding box extraction into
 * the original `StructuredSchemaParseResult` shape.
 *
 * STRICT MERGE RULES (non-retriable violations):
 * 1. Duplicate serialNo in stage-2 items → OcrMergeError
 * 2. Stage-2 item whose serialNo does not exist in stage-1 → OcrMergeError
 * 3. Stage-1 item with hasFigure=true but no matching stage-2 entry → OcrMergeError
 * 4. Stage-2 item reports figures for a field that stage-1 marked hasFigure=false → OcrMergeError
 *
 * Boxes are converted from 0-1000 integers to 0-1 fractions during merge.
 */
export function mergeStage1AndStage2(
  stage1: PartialSchemaParseResult,
  stage2: Stage2BoundingBoxResult,
): StructuredSchemaParseResult {
  // Build stage-2 index by serialNo, checking for duplicates.
  const stage2Map = new Map<number, Stage2Item>();
  for (const item of stage2.items) {
    if (stage2Map.has(item.serialNo)) {
      throw new OcrMergeError(
        `Duplicate serialNo ${item.serialNo} in stage-2 bounding box output.`,
      );
    }
    stage2Map.set(item.serialNo, item);
  }

  // Check for stage-2 serials that don't exist in stage-1.
  const stage1Serials = new Set(
    (stage1.data ?? []).map((i) => i.serialNo),
  );
  for (const [serialNo] of stage2Map) {
    if (!stage1Serials.has(serialNo)) {
      throw new OcrMergeError(
        `Stage-2 reports figures for serialNo ${serialNo} which does not exist in stage-1 output.`,
      );
    }
  }

  const mergedData: QuestionData[] = stage1.data.map((item) => {
    const stage2Item = stage2Map.get(item.serialNo);

    // --- Merge question ---
    let question: TextAndFigures | undefined;

    if (item.question) {
      if (item.question.hasFigure) {
        if (!stage2Item?.questionFigures?.length) {
          throw new OcrMergeError(
            `Serial ${item.serialNo}: question.hasFigure=true but no questionFigures in stage-2 output.`,
          );
        }
        question = {
          text: item.question.text,
          figures: stage2Item.questionFigures.map((b) => rescaleBox(b)),
        };
      } else {
        if (stage2Item?.questionFigures?.length) {
          throw new OcrMergeError(
            `Serial ${item.serialNo}: question.hasFigure=false but stage-2 reports questionFigures.`,
          );
        }
        question = { text: item.question.text, figures: [] };
      }
    } else {
      if (stage2Item?.questionFigures?.length) {
        throw new OcrMergeError(
          `Serial ${item.serialNo}: no question in stage-1 but stage-2 reports questionFigures.`,
        );
      }
      question = undefined;
    }

    // --- Merge solution ---
    let solution: TextAndFigures | undefined;

    if (item.solution) {
      if (item.solution.hasFigure) {
        if (!stage2Item?.solutionFigures?.length) {
          throw new OcrMergeError(
            `Serial ${item.serialNo}: solution.hasFigure=true but no solutionFigures in stage-2 output.`,
          );
        }
        solution = {
          text: item.solution.text,
          figures: stage2Item.solutionFigures.map((b) => rescaleBox(b)),
        };
      } else {
        if (stage2Item?.solutionFigures?.length) {
          throw new OcrMergeError(
            `Serial ${item.serialNo}: solution.hasFigure=false but stage-2 reports solutionFigures.`,
          );
        }
        solution = { text: item.solution.text, figures: [] };
      }
    } else {
      if (stage2Item?.solutionFigures?.length) {
        throw new OcrMergeError(
          `Serial ${item.serialNo}: no solution in stage-1 but stage-2 reports solutionFigures.`,
        );
      }
      solution = undefined;
    }

    // --- Merge options ---
    type OptionKey = keyof Stage2OptionFigures;
    const OPTION_KEYS = ["A", "B", "C", "D"] as const;
    let options: QuestionData["options"];

    if (item.options) {
      const mergedOptions: Record<string, OptionContent> = {};
      for (const key of OPTION_KEYS) {
        const option = item.options[key];
        if (!option) continue;
        if (option.hasFigure) {
          const stage2Figure = stage2Item?.optionFigures?.[key as OptionKey];
          if (!stage2Figure) {
            throw new OcrMergeError(
              `Serial ${item.serialNo}: option ${key}.hasFigure=true but no figure in stage-2 optionFigures.`,
            );
          }
          mergedOptions[key] = {
            text: option.text,
            figure: rescaleBox(stage2Figure),
          };
        } else {
          if (stage2Item?.optionFigures?.[key as OptionKey]) {
            throw new OcrMergeError(
              `Serial ${item.serialNo}: option ${key}.hasFigure=false but stage-2 reports a figure.`,
            );
          }
          mergedOptions[key] = { text: option.text };
        }
      }
      options = mergedOptions as QuestionData["options"];
    } else {
      const hasOrphanOptionFigure = OPTION_KEYS.some(
        (k) => stage2Item?.optionFigures?.[k as OptionKey],
      );
      if (hasOrphanOptionFigure) {
        throw new OcrMergeError(
          `Serial ${item.serialNo}: no options in stage-1 but stage-2 reports optionFigures.`,
        );
      }
      options = undefined;
    }

    return {
      serialNo: item.serialNo,
      question,
      options,
      answerKey: item.answerKey,
      subject: item.subject,
      marks: item.marks,
      solution,
      isContinuation: item.isContinuation ?? false,
    };
  });

  return {
    isRelevant: stage1.isRelevant,
    sectionLabel: stage1.sectionLabel,
    sectionStart: stage1.sectionStart,
    sectionEnd: stage1.sectionEnd,
    eachMarks: stage1.eachMarks,
    englishParagraph: stage1.englishParagraph,
    data: mergedData,
  };
}

/**
 * Converts a 0-1000 integer bounding box to a 0-1 fraction box.
 */
function rescaleBox(box: Stage2BoundingBox): BoundingBox {
  return {
    xMin: Number((box.xMin / 1000).toFixed(6)),
    yMin: Number((box.yMin / 1000).toFixed(6)),
    xMax: Number((box.xMax / 1000).toFixed(6)),
    yMax: Number((box.yMax / 1000).toFixed(6)),
  };
}

/**
 * Cleans, parses, and validates a raw LLM OCR response against the
 * structured OCR schema.
 *
 * When used with OpenRouter's structured output (`response_format: json_schema`),
 * the response is already guaranteed to be valid JSON matching the schema.
 * The parsing pipeline is simplified but retains fallback recovery:
 *
 * 1. Direct JSON.parse (primary path for structured output)
 * 2. Fallback: strip thinking tags, extract from fences, fix trailing commas
 * 3. Coversions: null -> undefined (nullable provider fields to optional Zod fields)
 * 4. Normalization: hoists page-level fields, reconciles legacy/singular figure shapes
 * 5. Zod validation as final safety net
 */
export function parseAndValidateStructuredOCR(
  rawText: string | null,
): StructuredOCRParseResult {
  if (!rawText?.trim()) {
    return {
      cleanedText: null,
      survivedValidation: false,
      validationErrors: ["Empty LLM response received."],
    };
  }

  const trimmed = rawText.trim();

  // Primary path: try direct JSON parse (structured output should always work here)
  let parsed = tryParseJson(trimmed);

  // Fallback path: strip thinking tags and extract from fences/braces
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

  // Convert nulls to undefined before Zod validation
  // (strict JSON Schema uses nullable, Zod schema uses optional)
  const cleaned = nullsToUndefined(parsed.json);
  const normalized = normalizeStructuredOCR(cleaned);

  const result = structuredOCRExtractionSchema.safeParse(normalized);
  if (!result.success) {
    return {
      cleanedText: parsed.source,
      survivedValidation: false,
      validationErrors: result.error.issues.map(
        (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
      ),
    };
  }

  return {
    cleanedText: parsed.source,
    survivedValidation: true,
    parsedStructuredData: result.data,
  };
}

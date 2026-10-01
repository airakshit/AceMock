import {
  StructuredSchemaParseResult,
  structuredOCRExtractionSchema,
} from "../ocr-page/structured-question-schema";

type StructuredOCRParseResult = {
  cleanedText: string | null;
  survivedValidation: boolean;
  parsedStructuredData?: StructuredSchemaParseResult;
  validationErrors?: string[];
};

const THINK_TAG = /<think>[\s\S]*?<\/think>/gi;
const CODE_FENCE = /```(?:json)?\s*([\s\S]*?)\s*```/i;
const TRAILING_COMMA = /,\s*([\]}])/g;

/**
 * Fallback: Pulls the JSON payload out of markdown fences, or the outermost {}.
 * Only needed when structured output is not used or the model wraps its response.
 */
function extractJsonPayload(text: string): string {
  const fenced = text.match(CODE_FENCE)?.[1];
  if (fenced) return fenced.trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start !== -1 && end > start ? text.slice(start, end + 1).trim() : text;
}

/** Parses JSON, retrying once with trailing commas stripped. */
function tryParseJson(
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
 * responses (which use nullable fields instead of optional).
 */
function nullsToUndefined<T>(obj: T): T {
  if (obj === null) return undefined as unknown as T;
  if (Array.isArray(obj)) return obj.map(nullsToUndefined) as unknown as T;
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== null) {
        result[key] = nullsToUndefined(value);
      }
      // null values are simply omitted → become undefined on access
    }
    return result as T;
  }
  return obj;
}

/**
 * Normalizes common LLM structural mistakes:
 * 1. Hoists page-level fields (`paragraph`, `sectionLabel`, `sectionStart`, `sectionEnd`, `eachMarks`)
 *    from items inside `data` to root if root doesn't already have them.
 * 2. Deletes page-level fields from `data` items so item validation succeeds.
 * 3. Normalizes root aliases (e.g. `sectionEnds` -> `sectionEnd`, root `marks` -> `eachMarks`).
 */
/**
 * Recursively repairs LaTeX strings where single backslashes in JSON output
 * were parsed as JSON escape sequences (e.g. \t -> tab, \f -> form feed, \b -> backspace).
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

function normalizeStructuredOCR(raw: unknown): unknown {
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
  if (typeof root.paragraph === "string") {
    root.paragraph = sanitizeLatexString(root.paragraph) as string;
  }

  // If items in data array contain page-level fields, lift to root and strip from item
  if (Array.isArray(root.data)) {
    root.data = root.data.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return item;
      const cleanItem = { ...(item as Record<string, unknown>) };

      if (typeof cleanItem.paragraph === "string" && !root.paragraph) {
        root.paragraph = sanitizeLatexString(cleanItem.paragraph) as string;
      }
      delete cleanItem.paragraph;

      if (typeof cleanItem.sectionLabel === "string" && !root.sectionLabel) {
        root.sectionLabel = cleanItem.sectionLabel;
      }
      delete cleanItem.sectionLabel;

      if (
        cleanItem.sectionStart !== undefined &&
        root.sectionStart === undefined
      ) {
        root.sectionStart = cleanItem.sectionStart;
      }
      delete cleanItem.sectionStart;

      if (cleanItem.sectionEnd !== undefined && root.sectionEnd === undefined) {
        root.sectionEnd = cleanItem.sectionEnd;
      }
      delete cleanItem.sectionEnd;

      if (
        cleanItem.sectionEnds !== undefined &&
        root.sectionEnd === undefined
      ) {
        root.sectionEnd = cleanItem.sectionEnds;
      }
      delete cleanItem.sectionEnds;

      if (cleanItem.eachMarks !== undefined && root.eachMarks === undefined) {
        root.eachMarks = cleanItem.eachMarks;
      }
      delete cleanItem.eachMarks;

      // Sanitize LaTeX strings in item content
      if (typeof cleanItem.question === "string") {
        cleanItem.question = sanitizeLatexString(cleanItem.question);
      }
      if (typeof cleanItem.solution === "string") {
        cleanItem.solution = sanitizeLatexString(cleanItem.solution);
      }
      if (typeof cleanItem.hint === "string") {
        cleanItem.hint = sanitizeLatexString(cleanItem.hint);
      }
      if (
        cleanItem.options &&
        typeof cleanItem.options === "object" &&
        !Array.isArray(cleanItem.options)
      ) {
        const cleanOptions: Record<string, unknown> = {};
        for (const [optKey, optVal] of Object.entries(
          cleanItem.options as Record<string, unknown>,
        )) {
          cleanOptions[optKey] = sanitizeLatexString(optVal);
        }
        cleanItem.options = cleanOptions;
      }

      return cleanItem;
    });
  }

  return root;
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
 * 2. Fallback: strip `<think>` tags, extract from fences, fix trailing commas
 * 3. Normalization: hoists page-level fields mistakenly placed in items
 * 4. Zod validation as final safety net
 * 5. Null → undefined conversion for downstream compatibility
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

  // Fallback path: strip <think> tags and extract from fences/braces
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

import { structuredOCRExtractionSchema } from "./schema";

type StructuredOCRParseResult = {
    cleanedText: string | null;
    survivedValidation: boolean;
    validationErrors?: string[];
};

const THINK_TAG = /<think>[\s\S]*?<\/think>/gi;
const CODE_FENCE = /```(?:json)?\s*([\s\S]*?)\s*```/i;
const TRAILING_COMMA = /,\s*([\]}])/g;

/** Pulls the JSON payload out of markdown fences, or the outermost {}. */
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
                error: err instanceof Error ? err.message : "Failed to parse JSON string.",
            };
        }
    }
}

/**
 * Cleans, parses, and validates a raw LLM OCR response against the
 * structured OCR schema.
 *
 * - Strips `<think>...</think>` reasoning tokens
 * - Extracts JSON from markdown fences or the outermost `{}`
 * - Recovers from trailing commas
 * - Validates the result with Zod
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

    const withoutThinking = rawText.replace(THINK_TAG, "").trim();
    const jsonPayload = extractJsonPayload(withoutThinking);

    const parsed = tryParseJson(jsonPayload);
    if (!parsed.ok) {
        return {
            cleanedText: jsonPayload,
            survivedValidation: false,
            validationErrors: [parsed.error],
        };
    }

    const result = structuredOCRExtractionSchema.safeParse(parsed.json);
    if (!result.success) {
        return {
            cleanedText: parsed.source,
            survivedValidation: false,
            validationErrors: result.error.issues.map(
                (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
            ),
        };
    }

    return { cleanedText: parsed.source, survivedValidation: true };
}
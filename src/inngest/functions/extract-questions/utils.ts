import { structuredOCRExtractionSchema } from "./schema";

/**
 * Robustly parses and validates raw LLM OCR response into structured JSON.
 * - Strips `<think>...</think>` reasoning tokens
 * - Extracts JSON from markdown code blocks or outermost braces
 * - Handles minor JSON malformations (e.g. trailing commas)
 * - Validates schema with Zod and collects descriptive error paths
 */
export function parseAndValidateStructuredOCR(rawText: string | null): {
    cleanedText: string | null;
    survivedValidation: boolean;
    validationErrors?: string[];
} {
    if (!rawText || !rawText.trim()) {
        return {
            cleanedText: null,
            survivedValidation: false,
            validationErrors: ["Empty LLM response received."],
        };
    }

    // 1. Remove reasoning model <think>...</think> tags
    let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    // 2. Extract JSON payload from markdown fences or outermost braces
    let jsonString = cleaned;
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
        jsonString = codeBlockMatch[1].trim();
    } else {
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonString = cleaned.slice(firstBrace, lastBrace + 1).trim();
        }
    }

    // 3. Attempt JSON parse with fallback for trailing commas
    let parsedJson: unknown = null;
    try {
        parsedJson = JSON.parse(jsonString);
        cleaned = jsonString;
    } catch {
        try {
            const sanitized = jsonString.replace(/,\s*([\]}])/g, "$1");
            parsedJson = JSON.parse(sanitized);
            cleaned = sanitized;
        } catch (parseError) {
            return {
                cleanedText: cleaned,
                survivedValidation: false,
                validationErrors: [
                    parseError instanceof Error ? parseError.message : "Failed to parse JSON string.",
                ],
            };
        }
    }

    // 4. Validate against Zod schema
    const parseResult = structuredOCRExtractionSchema.safeParse(parsedJson);

    if (!parseResult.success) {
        const errorMessages = parseResult.error.issues.map(
            (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
        );
        return {
            cleanedText: cleaned,
            survivedValidation: false,
            validationErrors: errorMessages,
        };
    }

    return {
        cleanedText: cleaned,
        survivedValidation: true,
    };
}
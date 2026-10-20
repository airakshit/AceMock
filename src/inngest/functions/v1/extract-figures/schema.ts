import { z } from "zod";
import type { StructuredJsonOptions } from "@/services/llm/base";
import { extractJsonPayload, tryParseJson } from "../ocr-page/utils";

/**
 * Both slots are always required in the raw response so the schema stays
 * unambiguous under strict output; "present" alone decides whether they carry
 * a value.
 */
const figureExtractionSchema = z.object({
  present: z.boolean(),
  svgQuestion: z.string().nullable(),
  svgSolution: z.string().nullable(),
});

export type FigureExtractionOutput = z.infer<typeof figureExtractionSchema>;

export const figureExtractionJsonSchema: StructuredJsonOptions = {
  name: "figure_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      present: { type: "boolean" },
      svgQuestion: { type: ["string", "null"] },
      svgSolution: { type: ["string", "null"] },
    },
    required: ["present", "svgQuestion", "svgSolution"],
    additionalProperties: false,
  },
};

/**
 * One figure per slot, keyed back to nothing else -- the caller already knows
 * which page and serial number the request came from.
 *
 * Parsing is lenient: structured output is the primary path, so the fallback
 * only has to recover a JSON payload the provider wrapped or spoiled.
 */
export function parseFigureExtraction(
  rawText: string | null,
): FigureExtractionOutput | null {
  if (!rawText?.trim()) return null;

  let parsed = tryParseJson(rawText.trim());
  if (!parsed.ok) {
    parsed = tryParseJson(extractJsonPayload(rawText));
  }
  if (!parsed.ok) return null;

  const result = figureExtractionSchema.safeParse(parsed.json);
  return result.success ? result.data : null;
}

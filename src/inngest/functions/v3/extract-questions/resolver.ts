/**
 * V3 LLM RESOLVER — the final safety net of the merger.
 *
 * Entities the pure stitcher could not resolve (orphan fragments, unlabeled
 * continuations, unmatched answer rows, questions with no usable content)
 * are sent to a dedicated Gemini call with neighboring context, and whatever
 * it salvages is converted into insertable ResolvedQuestions BEFORE the
 * database step. The resolver never edits successfully stitched questions —
 * it only works on the leftovers.
 */
import { z } from "zod";
import { GeminiLLMService } from "@/services/llm/gemini.service";
import type { StructuredJsonOptions } from "@/services/llm/base";
import {
  extractJsonPayload,
  nullsToUndefined,
  tryParseJson,
} from "../ocr-page/utils";
import type { UnresolvedEntity } from "./types";
import type { ResolvedQuestion } from "./types";
import {
  buildFailureReasons,
  deriveFigureFailureReason,
  deriveReadiness,
} from "./readiness";
import { formatPathDisplay } from "../ocr-page/path-utils";

// ---------------------------------------------------------------------------
// Resolver output schema (all-required + nullable unions for strict mode)
// ---------------------------------------------------------------------------

const resolvedOptionSchema = z.object({
  A: z.object({ text: z.string().nullable() }).nullable(),
  B: z.object({ text: z.string().nullable() }).nullable(),
  C: z.object({ text: z.string().nullable() }).nullable(),
  D: z.object({ text: z.string().nullable() }).nullable(),
});

export const resolverEntityResultSchema = z.object({
  id: z.string(),
  action: z.enum(["resolve", "discard"]),
  questionText: z.string().nullable(),
  options: resolvedOptionSchema.nullable(),
  correctOption: z
    .string()
    .nullable()
    .refine(
      (value) => value === null || ["A", "B", "C", "D"].includes(value),
      { message: "correctOption must be A, B, C, D or null" },
    ),
  solutionText: z.string().nullable(),
  answerValue: z.union([z.string(), z.number()]).nullable(),
  subject: z
    .string()
    .nullable()
    .refine(
      (value) =>
        value === null ||
        ["maths", "physics", "chemistry", "grammar", "comprehension"].includes(
          value,
        ),
      { message: "unknown subject" },
    ),
  marks: z.number().int().positive().nullable(),
  notes: z.string().nullable(),
});

export const resolverRootSchema = z.object({
  results: z.array(resolverEntityResultSchema).nullable(),
});

export type ResolverEntityResult = z.infer<typeof resolverEntityResultSchema>;
export type ResolverRoot = z.infer<typeof resolverRootSchema>;

const resolverRawJsonSchema = {
  type: "object",
  properties: {
    results: {
      type: ["array", "null"],
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          action: { enum: ["resolve", "discard"] },
          questionText: { type: ["string", "null"] },
          options: {
            type: ["object", "null"],
            properties: {
              A: {
                type: "object",
                properties: { text: { type: ["string", "null"] } },
                required: ["text"],
                additionalProperties: false,
              },
              B: {
                type: "object",
                properties: { text: { type: ["string", "null"] } },
                required: ["text"],
                additionalProperties: false,
              },
              C: {
                type: "object",
                properties: { text: { type: ["string", "null"] } },
                required: ["text"],
                additionalProperties: false,
              },
              D: {
                type: "object",
                properties: { text: { type: ["string", "null"] } },
                required: ["text"],
                additionalProperties: false,
              },
            },
            required: ["A", "B", "C", "D"],
            additionalProperties: false,
          },
          correctOption: { type: ["string", "null"], enum: ["A", "B", "C", "D", "null"] },
          solutionText: { type: ["string", "null"] },
          answerValue: { type: ["string", "number", "null"] },
          subject: {
            type: ["string", "null"],
            enum: ["maths", "physics", "chemistry", "grammar", "comprehension", "null"],
          },
          marks: { type: ["integer", "null"], minimum: 1 },
          notes: { type: ["string", "null"] },
        },
        required: [
          "id",
          "action",
          "questionText",
          "options",
          "correctOption",
          "solutionText",
          "answerValue",
          "subject",
          "marks",
          "notes",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

export const resolverJsonSchema: StructuredJsonOptions = {
  name: "unresolved_entity_resolver",
  schema: resolverRawJsonSchema,
  strict: true,
};

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export interface ResolutionContext {
  unresolved: UnresolvedEntity[];
  /** Raw OCR text of the pages around each unresolved entity. */
  pageRawTexts: Map<number, string | null>;
  /** Preview of resolved questions adjacent to the fragment (read order). */
  neighbors: Map<string, { previousLabel?: string; previousText?: string; nextLabel?: string; nextText?: string }>;
}

function truncate(text: string | null | undefined, max = 1200): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function describeEntity(entity: UnresolvedEntity["entity"]): unknown {
  return {
    path: entity.path ?? null,
    passage: entity.passage ? { text: entity.passage.text } : null,
    question: entity.question
      ? { text: entity.question.text ?? null, isStandalone: entity.question.isStandalone ?? null }
      : null,
    solution: entity.solution
      ? {
          text: entity.solution.text ?? null,
          answerValue: entity.solution.answerValue ?? null,
        }
      : null,
    options: entity.options
      ? {
          A: entity.options.A?.text ?? null,
          B: entity.options.B?.text ?? null,
          C: entity.options.C?.text ?? null,
          D: entity.options.D?.text ?? null,
        }
      : null,
    answerKey: entity.answerKey ?? null,
  };
}

export function buildResolutionPrompt(context: ResolutionContext): string {
  const items = context.unresolved
    .map((entry, index) => {
      const neighbor = context.neighbors.get(entry.id);
      return [
        `${index + 1}. id: "${entry.id}" (page ${entry.pageNo})`,
        `   problem: ${entry.reasons.join("; ") || "unresolved"}`,
        `   entity: ${JSON.stringify(describeEntity(entry.entity))}`,
        neighbor?.previousText
          ? `   previous resolved question (${neighbor.previousLabel ?? "?"}): "${truncate(neighbor.previousText, 300)}"`
          : null,
        neighbor?.nextText
          ? `   next resolved question (${neighbor.nextLabel ?? "?"}): "${truncate(neighbor.nextText, 300)}"`
          : null,
        `   raw OCR of page ${entry.pageNo}: "${truncate(context.pageRawTexts.get(entry.pageNo) ?? null)}"`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return `You are completing a question-extraction pipeline. An OCR + stitching pass over a scanned exam produced the entities below that could not be automatically resolved (fragments continuing across pages, unlabeled content, unmatched answer keys, empty text).

Your job: decide for EACH entity whether it contains a real question worth keeping, and if so output the COMPLETE question content (merging split fragments across the supplied context). Precision over coverage:
- If the material is a headline, instruction, continuation tail without any actual question, duplicated junk, or unreadable, choose "discard".
- If it is a real question (even partially incomplete), choose "resolve" and transcribe the question IN FULL, inferring any numbering continuation from the neighboring questions listed for context. Fix obvious split-sentence continuations by joining the fragment to its parent question text where context makes the join unambiguous.
- Do NOT invent options, answers, solutions, marks or subject that are not visible or inferable from context — leave those keys null.
- Keep math in KaTeX ($...$ / $$...$$, \\\\ce{} for chemistry), every backslash doubled in JSON. Transcribe verbatim otherwise.
- Match the numbering style of neighboring questions for text like "(ii)".

## Entities
${items}

## Output
One JSON object: { "results": [ { "id": <echo one id per entity>, "action": "resolve"|"discard", "questionText": string|null, "options": { "A": {"text": string|null}, ... }|null, "correctOption": "A"|"B"|"C"|"D"|null, "solutionText": string|null, "answerValue": string|number|null, "subject": "maths"|"physics"|"chemistry"|"grammar"|"comprehension"|null, "marks": integer|null, "notes": string|null } ] }
- Output ONE result object per input entity, echoing its id exactly.
- "options" null when the question is not multiple-choice.`;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface ResolutionOutcome {
  /** Resolved questions salvageable from the leftovers. */
  resolved: ResolvedQuestion[];
  /** Entries the resolver chose to discard or failed to parse. */
  discarded: Array<{ id: string; notes?: string }>;
  /** Ids of unresolved entities that failed resolution entirely. */
  failed: string[];
}

export async function resolveUnresolvedEntities(
  llmService: GeminiLLMService,
  unresolved: UnresolvedEntity[],
  context: {
    pageRawTexts: Map<number, string | null>;
    neighbors: Map<
      string,
      {
        previousLabel?: string;
        previousText?: string;
        nextLabel?: string;
        nextText?: string;
      }
    >;
  },
): Promise<ResolutionOutcome> {
  if (unresolved.length === 0) {
    return { resolved: [], discarded: [], failed: [] };
  }

  const raw = await llmService.call(
    buildResolutionPrompt({ unresolved, ...context }),
    undefined,
    [],
    resolverJsonSchema,
  );

  const parsed = parseResolverResponse(raw);
  if (!parsed) {
    return {
      resolved: [],
      discarded: [],
      failed: unresolved.map((entry) => entry.id),
    };
  }

  const byId = new Map(unresolved.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();
  const resolved: ResolvedQuestion[] = [];
  const discarded: ResolutionOutcome["discarded"] = [];
  const failed: string[] = [];

  for (const result of parsed.results ?? []) {
    const entry = byId.get(result.id);
    if (!entry) continue;
    seen.add(result.id);

    if (result.action !== "resolve") {
      discarded.push({ id: result.id, notes: result.notes ?? undefined });
      continue;
    }

    const questionText = (result.questionText ?? "").trim();
    const options = buildResolverOptions(result.options);
    if (!questionText && options.length === 0) {
      discarded.push({ id: result.id, notes: "resolver returned empty content" });
      continue;
    }

    // Cross-check: if the solution's final answer value matches an option
    // text, that option is the correct one (physics/math worked answers).
    const finalValue = result.answerValue !== null
      ? String(result.answerValue).trim()
      : null;
    const crossCheckOption = finalValue !== null
      ? options.find((opt) => opt.text.trim() === finalValue)?.key
      : undefined;

    const { isReady, reasons } = deriveReadiness({
      question: questionText,
      questionFigureCount: 0,
      hasOptions: options.length > 0,
      optionCount: options.length,
      solution: result.solutionText,
      answerKey: result.correctOption ?? null,
      answerValue:
        result.answerValue !== null ? String(result.answerValue) : null,
    });

    resolved.push({
      fileId: entry.fileId,
      pageNos: [entry.pageNo],
      path: entry.entity.path ?? [],
      label: formatPathDisplay(entry.entity.path ?? null) || "(resolved)",
      pathKey: `resolved:${result.id}`,
      question: questionText,
      isStandalone: false,
      options,
      correctOption: result.correctOption ?? crossCheckOption ?? options[0]?.key ?? "A",
      marks: result.marks ?? 1,
      subject: result.subject ?? undefined,
      hint: null,
      solution: result.solutionText,
      answerValue: result.answerValue !== null ? String(result.answerValue) : null,
      // Resolver-recovered questions carry no figure-resolution data; a
      // resolver can never confirm a figure, so mark it unresolved until a
      // human confirms otherwise.
      figureResolved: entry.entity.figureResolved !== false,
      figureNotFound: entry.entity.figureNotFound === true,
      failureReasons: buildFailureReasons(
        reasons,
        deriveFigureFailureReason({
          figureResolved: entry.entity.figureResolved !== false,
          figureNotFound: entry.entity.figureNotFound,
        }),
      ),
      needsReview: true,
      reviewReasons: [
        ...(entry.reasons.length ? entry.reasons : ["resolver-recovered"]),
        result.notes ? `resolver-notes:${result.notes}` : "",
      ].filter(Boolean),
      isReady,
    });
  }

  for (const entry of unresolved) {
    if (!seen.has(entry.id)) failed.push(entry.id);
  }

  return { resolved, discarded, failed };
}

function parseResolverResponse(raw: string | null): ResolverRoot | null {
  if (!raw?.trim()) return null;
  let parsed = tryParseJson(raw.trim());
  if (!parsed.ok) {
    const payload = extractJsonPayload(raw.replace(/<think[\s\S]*?<\/think>/gi, ""));
    parsed = tryParseJson(payload);
  }
  if (!parsed.ok) return null;

  const cleaned = nullsToUndefined(parsed.json);
  const result = resolverRootSchema.safeParse(cleaned);
  return result.success ? result.data : null;
}

function buildResolverOptions(
  options: ResolverEntityResult["options"],
): Array<{ key: "A" | "B" | "C" | "D"; text: string }> {
  if (!options) return [];
  const out: Array<{ key: "A" | "B" | "C" | "D"; text: string }> = [];
  for (const key of ["A", "B", "C", "D"] as const) {
    const text = options[key]?.text?.trim();
    if (text) out.push({ key, text });
  }
  return out;
}

/**
 * V3 STANDALONE REWRITER — an LLM polish pass over non-standalone questions.
 *
 * Subquestions printed under a directive stem (or split fragments) are not
 * usable as-is on their own. The stitcher gathers each fragment's OWN text,
 * its parent stem, and its neighboring complete siblings, and this module
 * asks the LLM to write complete, self-contained question and solution text.
 *
 * Figures are NEVER sent as image data: every figure is represented by a
 * `[[FIG:<path>]]` annotation token so the model knows a diagram exists and
 * keeps the marker positioned sensibly in the rewritten text. The runner
 * re-appends any token the model dropped, so annotations can never be lost.
 */
import { z } from "zod";
import { GeminiLLMService } from "@/services/llm/gemini.service";
import type { StructuredJsonOptions } from "@/services/llm/base";
import {
  extractJsonPayload,
  nullsToUndefined,
  tryParseJson,
} from "../ocr-page/utils";
import type { ResolvedQuestion, StandaloneRewriteJob } from "./types";

// ---------------------------------------------------------------------------
// Output schema (all-required + nullable unions for strict mode)
// ---------------------------------------------------------------------------

const standaloneResultSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.string(),
        questionText: z.string().nullable(),
        solutionText: z.string().nullable(),
        notes: z.string().nullable(),
      }),
    )
    .nullable(),
});

type StandaloneRoot = z.infer<typeof standaloneResultSchema>;

const standaloneRawJsonSchema = {
  type: "object",
  properties: {
    results: {
      type: ["array", "null"],
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          questionText: { type: ["string", "null"] },
          solutionText: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },
        },
        required: ["id", "questionText", "solutionText", "notes"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

export const standaloneJsonSchema: StructuredJsonOptions = {
  name: "standalone_question_rewriter",
  schema: standaloneRawJsonSchema,
  strict: true,
};

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function truncate(text: string, max = 500): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function buildStandalonePrompt(jobs: StandaloneRewriteJob[]): string {
  const items = jobs
    .map((job, index) => {
      const surrounding = job.surrounding.length
        ? job.surrounding
            .map(
              (sib) =>
                `   ${sib.label}: "${truncate(sib.question || "(no text)")}"` +
                (sib.solution ? ` [solution: "${truncate(sib.solution, 200)}"]` : ""),
            )
            .join("\n")
        : null;

      return [
        `${index + 1}. id: "${job.id}" (path ${job.pathKey}, page ${job.pageNo})`,
        `   own question text: "${truncate(job.ownQuestionText || "(none — figure-only fragment)")}"`,
        job.ownSolutionText
          ? `   own solution text: "${truncate(job.ownSolutionText)}"`
          : null,
        job.parentStem
          ? `   parent question stem this belongs under: "${truncate(job.parentStem)}"`
          : null,
        job.figureAnnotations.length
          ? `   figure annotations present: ${job.figureAnnotations.join(" ")}`
          : null,
        surrounding
          ? `   neighboring complete siblings:\n${surrounding}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return `You are polishing a question-extraction pipeline's output. A scanned exam was OCR'd and stitched; the numbers below are SUBQUESTIONS or FRAGMENTS that were printed under a parent directive/stem, so their text alone is not self-contained.

Your job: rewrite EACH fragment as a COMPLETE, standalone question (and solution when present) by combining its own text with the parent stem and using neighboring siblings as context. Precision over coverage:
- Produce the question text the student needs to answer WITHOUT seeing the original page layout:
  - Prefix directive fragments of the parent stem that the fragment relies on ("Answer the following:", "4. In the figure above...").
  - Fix split sentences; keep the fragment's own printed numbering prefix (e.g. "(ii)") input untouched where it makes sense.
- NEVER invent options, answers, marks or solution content that is not visible in the supplied material. If the fragment only questions and the answer printed elsewhere, leave solutionText null.
- Figures are invisible to you: a "figure annotations present" token [[FIG:<path>]] means a diagram exists there for that path (this fragment or its parent). You MUST keep every supplied annotation token EXACTLY as written in the rewritten text, at the position that references it (append at the end if it is not clear). Do not add new [[FIG:...]] tokens that were not supplied.
- Keep math in KaTeX ($...$ / $$...$$, \\\\ce{} for chemistry), with every backslash doubled in JSON. Transcribe verbatim otherwise.

## Fragments
${items}

## Output
One JSON object: { "results": [ { "id": <echo one id per fragment>, "questionText": string|null, "solutionText": string|null, "notes": string|null } ] }
- Output ONE result object per input fragment, echoing its id exactly.
- questionText null only when the fragment carries no reusable question content.`;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface StandaloneRewriteOutcome {
  /**
   * Rewritten fragments. Plain array (NOT a Map) because inngest step
   * results are JSON-serialized across the step boundary.
   */
  rewrites: Array<{
    id: string;
    questionText?: string;
    solutionText?: string;
    notes?: string;
  }>;
  /** Ids the model dropped, failed or returned empty. */
  skipped: string[];
}

export async function rewriteStandaloneEntities(
  llmService: GeminiLLMService,
  jobs: StandaloneRewriteJob[],
): Promise<StandaloneRewriteOutcome> {
  if (jobs.length === 0) {
    return { rewrites: [], skipped: [] };
  }

  const raw = await llmService.call(
    buildStandalonePrompt(jobs),
    undefined,
    [],
    standaloneJsonSchema,
  );

  const parsed = parseStandaloneResponse(raw);
  if (!parsed) {
    return { rewrites: [], skipped: jobs.map((job) => job.id) };
  }

  const byId = new Map(jobs.map((job) => [job.id, job]));
  const rewrites: StandaloneRewriteOutcome["rewrites"] = [];
  const skipped = new Set(jobs.map((job) => job.id));

  for (const result of parsed.results ?? []) {
    const job = byId.get(result.id);
    if (!job) continue;
    skipped.delete(result.id);

    const questionText = (result.questionText ?? "").trim();
    const solutionText = (result.solutionText ?? "").trim();
    if (!questionText && !solutionText) {
      // Nothing usable — the deterministic fallback text stays in place.
      continue;
    }
    rewrites.push({
      id: result.id,
      questionText: questionText || undefined,
      solutionText: solutionText || undefined,
      notes: result.notes ?? undefined,
    });
  }

  return { rewrites, skipped: [...skipped] };
}

function parseStandaloneResponse(raw: string | null): StandaloneRoot | null {
  if (!raw?.trim()) return null;
  let parsed = tryParseJson(raw.trim());
  if (!parsed.ok) {
    const payload = extractJsonPayload(raw.replace(/<think[\s\S]*?<\/think>/gi, ""));
    parsed = tryParseJson(payload);
  }
  if (!parsed.ok) return null;

  const cleaned = nullsToUndefined(parsed.json);
  const result = standaloneResultSchema.safeParse(cleaned);
  return result.success ? result.data : null;
}

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

/** Re-appends any dropped `[[FIG:...]]` annotation so markers never vanish. */
function ensureFigureTokens(text: string, annotations: string[]): string {
  const missing = annotations.filter((token) => !text.includes(token));
  if (missing.length === 0) return text;
  return `${text.trim()} ${missing.join(" ")}`.trim();
}

/**
 * Applies LLM rewrites onto the reference `questions` list. Falls back to
 * the stitcher's deterministic merged text for anything that was skipped.
 */
export function applyStandaloneRewrites(
  questions: ResolvedQuestion[],
  jobs: StandaloneRewriteJob[],
  outcome: StandaloneRewriteOutcome,
): void {
  if (outcome.rewrites.length === 0) return;
  const jobsById = new Map(jobs.map((job) => [job.id, job]));

  for (const rewrite of outcome.rewrites) {
    const job = jobsById.get(rewrite.id);
    if (!job) continue;
    const target = questions.find((q) => q.recordKey === rewrite.id);
    if (!target) continue;

    if (rewrite.questionText) {
      target.question = ensureFigureTokens(
        rewrite.questionText,
        job.figureAnnotations,
      );
    }
    if (rewrite.solutionText) {
      target.solution = ensureFigureTokens(
        rewrite.solutionText,
        job.figureAnnotations,
      );
    }
  }
}

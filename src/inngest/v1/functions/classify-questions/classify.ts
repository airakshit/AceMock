import { z } from "zod";
import { env } from "@/config/env/server";
import type { StructuredJsonOptions } from "@/services/llm/base";
import {
  GroqLLMService,
  GroqModels,
  type GroqModel,
} from "@/services/llm/groq.service";
import type { ClassifiableQuestion } from "./classifiable-question-schema";
import {
  buildChapterClassificationPrompt,
  buildSectionClassificationPrompt,
  type ClassificationCandidate,
} from "./prompts";

/**
 * Classification is a small, high-volume decision, so a fast Groq model is a
 * better fit than the heavier OCR models. Swap the constant to retune speed
 * versus accuracy.
 */
const CLASSIFICATION_MODEL: GroqModel = GroqModels.GPT_OSS_20B;

const CLASSIFY_SECTIONS_OUTPUT_NAME = "classify_question_sections";
const CLASSIFY_CHAPTERS_OUTPUT_NAME = "classify_question_chapters";

let groqClient: GroqLLMService | null = null;

function getGroqClient(): GroqLLMService {
  groqClient ??= new GroqLLMService(env.GROQ_API_KEY, CLASSIFICATION_MODEL);
  return groqClient;
}

/** Loose JSON extraction — structured output is preferred, not guaranteed. */
const CODE_FENCE = /```(?:json)?\s*([\s\S]*?)\s*```/i;

const RATE_LIMIT_HINT = /\b(429|rate limit|too many requests)\b/i;

/**
 * A rate-limited call will fail again on the immediate retry, so let it
 * propagate to Inngest's backoff instead of burning a second request.
 */
function isRateLimitError(error: unknown): boolean {
  return error instanceof Error && RATE_LIMIT_HINT.test(error.message);
}

function extractJsonPayload(text: string): string {
  const fenced = text.match(CODE_FENCE)?.[1];
  if (fenced) return fenced.trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start !== -1 && end > start ? text.slice(start, end + 1).trim() : text;
}

const classificationResponseSchema = z.object({
  items: z.array(
    z.object({
      index: z.coerce.number().int().nonnegative(),
      slug: z.string(),
    }),
  ),
});

function parseClassificationItems(content: string | null): Array<{
  index: number;
  slug: string;
}> {
  if (!content) return [];

  try {
    const parsed = classificationResponseSchema.safeParse(
      JSON.parse(extractJsonPayload(content)),
    );
    return parsed.success ? parsed.data.items : [];
  } catch {
    return [];
  }
}

/**
 * Restricting the slug to a per-stage enum means the model can only emit a
 * value that actually exists in this stage's candidate list.
 */
function buildClassificationOutputSchema(
  name: string,
  candidates: ClassificationCandidate[],
): StructuredJsonOptions {
  return {
    name,
    strict: true,
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              index: { type: "integer" },
              slug: {
                type: "string",
                enum: candidates.map((candidate) => candidate.slug),
              },
            },
            required: ["index", "slug"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  };
}

/**
 * Runs one classification call. Structured output is attempted first; if the
 * provider rejects it, the same prompt is retried unstructured and parsed
 * leniently, so a single schema hiccup does not abort a whole document run.
 */
async function runClassification(
  prompt: string,
  outputName: string,
  candidates: ClassificationCandidate[],
): Promise<Array<{ index: number; slug: string }>> {
  const llm = getGroqClient();

  let content: string | null;
  try {
    content = await llm.call(
      prompt,
      CLASSIFICATION_MODEL,
      undefined,
      buildClassificationOutputSchema(outputName, candidates),
    );
  } catch (error) {
    if (isRateLimitError(error)) throw error;
    content = await llm.call(prompt, CLASSIFICATION_MODEL);
  }

  return parseClassificationItems(content);
}

/**
 * Projects the model's `{ index, slug }` pairs back onto the input array,
 * dropping answers whose slug is not a legal candidate for this stage.
 */
function resolveOutcomes(
  count: number,
  items: Array<{ index: number; slug: string }>,
  candidates: ClassificationCandidate[],
): Array<string | null> {
  const allowed = new Set(candidates.map((candidate) => candidate.slug));
  const slugByIndex = new Map<number, string>();

  for (const item of items) {
    if (item.index >= count) continue;
    if (!allowed.has(item.slug)) continue;
    slugByIndex.set(item.index, item.slug);
  }

  return Array.from({ length: count }, (_, index) => {
    return slugByIndex.get(index) ?? null;
  });
}

/**
 * Stage 1 — assign each question to one of the subject's sections.
 * Returns one slug per input question, `null` where classification failed.
 */
export async function classifySections(input: {
  subjectName: string;
  sections: ClassificationCandidate[];
  questions: ClassifiableQuestion[];
}): Promise<Array<string | null>> {
  if (input.sections.length === 0 || input.questions.length === 0) {
    return input.questions.map(() => null);
  }

  // A subject with a single section has nothing to choose between.
  if (input.sections.length === 1) {
    return input.questions.map(() => input.sections[0].slug);
  }

  const items = await runClassification(
    buildSectionClassificationPrompt(input),
    CLASSIFY_SECTIONS_OUTPUT_NAME,
    input.sections,
  );

  return resolveOutcomes(input.questions.length, items, input.sections);
}

/**
 * Stage 2 — assign each question to one of its section's chapters.
 * Returns one slug per input question, `null` where classification failed.
 */
export async function classifyChapters(input: {
  subjectName: string;
  sectionName: string;
  chapters: ClassificationCandidate[];
  questions: ClassifiableQuestion[];
}): Promise<Array<string | null>> {
  if (input.chapters.length === 0 || input.questions.length === 0) {
    return input.questions.map(() => null);
  }

  if (input.chapters.length === 1) {
    return input.questions.map(() => input.chapters[0].slug);
  }

  const items = await runClassification(
    buildChapterClassificationPrompt(input),
    CLASSIFY_CHAPTERS_OUTPUT_NAME,
    input.chapters,
  );

  return resolveOutcomes(input.questions.length, items, input.chapters);
}

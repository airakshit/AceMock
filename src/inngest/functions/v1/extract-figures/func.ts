import { inngest } from "../../../client";
import { supabaseStorageClient } from "@/features/shared/storage-service";
import {
  OpenRouterLLMService,
  OpenRouterModels,
} from "@/services/llm/openrouter.service";
import { env } from "@/config/env/server";
import { buildFigureExtractionPrompt } from "./prompts";
import { figureExtractionJsonSchema, parseFigureExtraction } from "./schema";
import { firstSvgDocument } from "./svg";
import { FigureExtractionFailedError } from "./errors";
import {
  EXTRACT_FIGURES_EVENT,
  ExtractFiguresEventData,
  FigureExtractionRequest,
  FigureExtractionResult,
} from "./types";

/** Same vision model the page OCR uses, so both stages share one contract. */
const FIGURE_OCR_MODEL = OpenRouterModels.DOTS_3_NOTE_PREVIEW;

/** Ten times longer than the default, so long jobs do not die mid-drawing. */
const SIGNED_URL_EXPIRY_SECONDS = 900;

/**
 * Figures are the most failure-prone call in the pipeline — and the cheapest to
 * retry, because page OCR is already done at this point, so a re-run skips
 * straight back into figure work.
 */
const TOTAL_RETRIES = 3;

/**
 * Number of figure jobs the provider handles at once. Production opens this up
 * freely; the cap only stops a burst from fanning out unbounded.
 */
const MAX_CONCURRENT_JOBS = 4;

function figureJobId(request: FigureExtractionRequest): string {
  return `extract-figure-${request.fileId}-page-${request.pageNo}-item-${request.serialNo}`;
}

/**
 * Phase 2 of the extraction pipeline.
 *
 * Phase 1 (`ocr-page`) transcribes an entire page and only reports whether each
 * item contains a figure. This function takes those flagged (page, serial
 * number) pairs, goes back to the page image, and renders the figure as SVG —
 * one call per item, so that call's entire output budget is spent on a single
 * drawing instead of competing with question text, options and solutions.
 */
export const extractFigures = inngest.createFunction(
  {
    id: "extract-figures-from-pages",
    triggers: { event: EXTRACT_FIGURES_EVENT },
    retries: TOTAL_RETRIES,
    concurrency: { limit: MAX_CONCURRENT_JOBS },
  },
  async ({ event, step, logger, attempt }) => {
    const { userId, documentId, requests } =
      event.data as ExtractFiguresEventData;

    if (!requests?.length) {
      logger.info(
        { documentId },
        "No figure requests supplied; nothing to extract.",
      );
      return { results: [] as FigureExtractionResult[] };
    }

    // One signed URL per page, shared by every job that targets that page.
    const pageStoragePaths = [...new Set(requests.map((r) => r.storagePath))];

    const signedUrls = await step.run("sign-page-images", async () => {
      const pairs = await Promise.all(
        pageStoragePaths.map(async (storagePath) => {
          const signedUrl = await supabaseStorageClient.getPageAccessUrl(
            storagePath,
            SIGNED_URL_EXPIRY_SECONDS,
          );
          return { storagePath, signedUrl };
        }),
      );

      logger.info(
        {
          documentId,
          pages: pairs.length,
          jobs: requests.length,
          userId,
        },
        "Signed page images for figure extraction.",
      );

      return Object.fromEntries(pairs.map((p) => [p.storagePath, p.signedUrl]));
    });

    const llmService = new OpenRouterLLMService(
      env.OPENROUTER_API_KEY!,
      FIGURE_OCR_MODEL,
    );

    const results = (await Promise.all(
      requests.map((request) =>
        step.run(
          figureJobId(request),
          async (): Promise<FigureExtractionResult> => {
            const signedUrl = signedUrls[request.storagePath];
            if (!signedUrl) {
              throw new FigureExtractionFailedError(
                `item ${request.serialNo} on page ${request.pageNo}`,
                "no signed page image was produced.",
              );
            }

            const output = await extractSingleFigure({
              llmService,
              signedUrl,
              request,
              attempt,
            });

            logger.info(
              {
                documentId,
                pageId: request.pageId,
                serialNo: request.serialNo,
                questionFigure: Boolean(output.svgQuestion),
                solutionFigure: Boolean(output.svgSolution),
                model: llmService.model,
              },
              "Figure extracted.",
            );

            return output;
          },
        ),
      ),
    )) as FigureExtractionResult[];

    return { results };
  },
);

/**
 * Runs one focused vision call: one page, one serial number.
 *
 * Throws on any unusable response so Inngest retries that step; a legitimate
 * "this item has no figure on this page" is not a failure and returns nulls.
 */
async function extractSingleFigure(input: {
  llmService: OpenRouterLLMService;
  signedUrl: string;
  request: FigureExtractionRequest;
  attempt: number;
}): Promise<FigureExtractionResult> {
  const { llmService, signedUrl, request, attempt } = input;
  const item = `item ${request.serialNo} on page ${request.pageNo}`;

  let rawText: string | null = null;
  try {
    rawText = await llmService.call(
      buildFigureExtractionPrompt({
        serialNo: request.serialNo,
        pageNo: request.pageNo,
      }),
      undefined,
      [signedUrl],
      figureExtractionJsonSchema,
    );
  } catch (error) {
    throw new FigureExtractionFailedError(
      item,
      `extraction call failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const output = parseFigureExtraction(rawText);

  if (!output) {
    throw new FigureExtractionFailedError(
      `${item} (attempt ${attempt + 1}/${TOTAL_RETRIES + 1})`,
      rawText
        ? "the response could not be parsed as a figure result."
        : "the model returned no response.",
    );
  }

  // Stage 1 flagged this item, but the focused pass did not find a figure
  // after all — a false positive, not a failure.
  if (!output.present) {
    return {
      pageId: request.pageId,
      fileId: request.fileId,
      pageNo: request.pageNo,
      serialNo: request.serialNo,
      svgQuestion: null,
      svgSolution: null,
    };
  }

  const svgQuestion = firstSvgDocument(output.svgQuestion);
  const svgSolution = firstSvgDocument(output.svgSolution);

  if (!svgQuestion && !svgSolution) {
    throw new FigureExtractionFailedError(
      `${item} (attempt ${attempt + 1}/${TOTAL_RETRIES + 1})`,
      "present was true but no usable svg document was returned.",
    );
  }

  return {
    pageId: request.pageId,
    fileId: request.fileId,
    pageNo: request.pageNo,
    serialNo: request.serialNo,
    svgQuestion,
    svgSolution,
  };
}

import { inngest } from "../../../client";
import { supabaseStorageClient } from "@/features/shared/storage-service";
import {
  buildStage2BoundingBoxPrompt,
  structuredTextExtractionPromptV3,
} from "./prompts";
import { documentRepository } from "@/features/documents/repositories/documents.repository";
import { db } from "@/db";
import { OcrPageResult } from "./types";
import { GeminiLLMService, GeminiModels } from "@/services/llm/gemini.service";
import {
  collectFigureTargets,
  mergeStage1AndStage2,
  parsePartialStructuredOCR,
  parseStage2BoundingBoxes,
} from "./utils";
import {
  OcrValidationError,
  OcrEmptyResponseError,
  OcrMergeError,
} from "./errors";
import {
  partialOCRJsonSchema,
  stage2BoundingBoxRootJsonSchema,
} from "./new-schema";
import type { StructuredPageParseResult } from "./super-schema";
import type { PartialPageParseResult } from "./new-schema";
import { env } from "@/config/env/server";
import { RateLimitError } from "@/services/llm/errors";
import { NonRetriableError, RetryAfterError } from "inngest";
import { FilePageOCRStatus } from "@/features/documents/types";
import { createOcrLogger } from "@/lib/logger";
import {
  extractFiguresFromPage,
  type ExtractedFigure,
} from "./extract-figures";

export interface OcrPageEventData {
  userId: string;
  documentId: string;
  fileId: string;
  fileName: string;
  pageId: string;
  pageNo: number;
  storagePath: string;
}

export const TOTAL_RETRIES = 2;
export const PAGE_OCR_EVENT = "v3/page/ocr";
export const OCR_FN_VERSION = 3;

export const ocrPage = inngest.createFunction(
  {
    id: "ocr-page-v3",
    triggers: { event: PAGE_OCR_EVENT },
    retries: TOTAL_RETRIES,
    concurrency: {
      limit: 3,
    },
  },

  async ({
    event,
    step,
    logger: inngestLogger,
    attempt,
  }): Promise<OcrPageResult & { extractedFigures?: ExtractedFigure[] }> => {
    const data = event.data as OcrPageEventData;
    const {
      fileId,
      pageId,
      pageNo,
      storagePath,
      userId,
      documentId,
      fileName,
    } = data;

    // Structured page-scoped logger. Every log line carries document/file/page
    // context so errors are traceable across the two-stage flow.
    const log = createOcrLogger({
      documentId,
      fileId,
      pageNo,
      pageId,
      fnVersion: OCR_FN_VERSION,
      stage: "page-ocr",
    });

    log.info("Page OCR started", { attempt, storagePath });

    // 0. Update file page status to "running"
    await step.run("update-file-ocr-status", async () => {
      await documentRepository.commands.updateFilePageStatusByPageId(
        db,
        pageId,
        "running" as FilePageOCRStatus,
      );
    });

    // 1. Generate a signed URL for the page image in Supabase storage
    const signedUrl = await step.run("get-page-access-url", async () => {
      return await supabaseStorageClient.getPageAccessUrl(storagePath);
    });

    // Gemini only for v3 OCR by decision. The client implementation itself
    // remains in src/services/llm/.
    const llmService = new GeminiLLMService(
      env.GEMINI_API_KEY,
      GeminiModels.GEMINI_3_5_FLASH_LITE,
    );

    // ---------------------------------------------------------------------
    // STAGE 1 — text / LaTeX extraction + hasFigure detection (PATH identity)
    // ---------------------------------------------------------------------
    const stage1 = await step.run(
      "llm-ocr-stage-1-text",
      async (): Promise<{
        rawText: string | null;
        survivedValidation: boolean;
        isRelevant: boolean;
        isStartOpen: boolean;
        isEndOpen: boolean;
        data?: PartialPageParseResult;
      }> => {
        let rawText: string | null = null;
        try {
          rawText = await llmService.call(
            structuredTextExtractionPromptV3,
            undefined,
            [signedUrl],
            partialOCRJsonSchema,
          );
          log.debug("Stage-1 raw output received", {
            model: llmService.model,
            outputLength: rawText?.length ?? 0,
            outputPreview: rawText?.slice(0, 500),
          });
        } catch (error) {
          if (error instanceof RateLimitError) {
            log.error("Rate limit error in stage 1", {
              message: error.message,
              model: error.model,
              provider: error.llmProvider,
              retryAfterMs: error.retryAfterMs,
            }, error);
            throw new RetryAfterError(error.message, error.retryAfterMs);
          }
          log.error("Unexpected LLM error in stage 1", {}, error);
          throw error;
        }

        if (!rawText && attempt < TOTAL_RETRIES) {
          throw new OcrEmptyResponseError(
            `No response returned by LLM on page ${pageNo} stage 1 (attempt ${attempt + 1}/${TOTAL_RETRIES + 1}).`,
          );
        }

        const {
          cleanedText,
          survivedValidation,
          validationErrors,
          parsedStructuredData,
          entityIndex,
        } = parsePartialStructuredOCR(rawText);

        if (!cleanedText && attempt < TOTAL_RETRIES) {
          throw new OcrEmptyResponseError(
            `No valid stage-1 response text could be extracted on page ${pageNo} (attempt ${attempt + 1}/${TOTAL_RETRIES + 1}).`,
          );
        }

        if (!survivedValidation) {
          // Log the FULL context: validation errors, raw output, page, attempt,
          // and the offending entity index (e.g. "entities.45").
          log.error("Stage-1 structured OCR validation failed", {
            validationErrors,
            entityIndex,
            rawOutput: rawText?.slice(0, 2000),
            attempt,
          }, new OcrValidationError(
            `Stage-1 structured OCR validation failed for page ${pageNo}: ${validationErrors?.join("; ") || "Schema validation failed"}`,
            {
              validationErrors,
              pageNo,
              attempt,
              stage: "stage-1",
              rawOutput: rawText ?? undefined,
              entityIndex,
            },
          ));

          if (attempt < TOTAL_RETRIES) {
            throw new OcrValidationError(
              `Stage-1 structured OCR validation failed for page ${pageNo}: ${validationErrors?.join("; ") || "Schema validation failed"}`,
              {
                validationErrors,
                pageNo,
                attempt,
                stage: "stage-1",
                rawOutput: rawText ?? undefined,
                entityIndex,
              },
            );
          }
          // Final attempt: proceed with best-effort text (non-blocking).
          log.warn("Stage-1 validation failed on final attempt; proceeding with best-effort text", {
            validationErrors,
            rawOutput: rawText?.slice(0, 500),
          });
        }

        const parsed = parsedStructuredData;
        return {
          rawText: cleanedText,
          survivedValidation,
          isRelevant: parsed?.isRelevant ?? true,
          isStartOpen: parsed?.isStartOpen ?? false,
          isEndOpen: parsed?.isEndOpen ?? false,
          data: parsed,
        };
      },
    );

    // ---------------------------------------------------------------------
    // STAGE 2 — bounding boxes, only for entities with hasFigure=true.
    // ---------------------------------------------------------------------
    let mergedData: StructuredPageParseResult | undefined;

    if (stage1.survivedValidation && stage1.data) {
      // Inngest types step returns as JsonifyObject — the parse output is
      // genuinely JSON-safe, so a direct widening is safe.
      const stage1Data = stage1.data as PartialPageParseResult;
      let figureTargets;
      try {
        figureTargets = collectFigureTargets(stage1Data);
      } catch (error) {
        // Unlabeled-target ambiguity etc. — cannot run stage 2 at all.
        log.error("Failed to derive stage-2 figure targets", {
          message: error instanceof Error ? error.message : String(error),
        }, error);
        throw new NonRetriableError(
          error instanceof Error ? error.message : String(error),
        );
      }

      if (figureTargets.length === 0) {
        // No figures on this page — merge with an empty stage-2 result.
        mergedData = mergeStage1AndStage2(stage1Data, { items: [] });
      } else {
        log.info("Stage-2 figure targets derived", {
          targetCount: figureTargets.length,
          targets: figureTargets.map((t) => ({
            path: t.path,
            needs: t.needs,
          })),
        });

        const stage2Raw = await step.run("llm-ocr-stage-2-bbox", async () => {
          const stage2Prompt = buildStage2BoundingBoxPrompt(
            pageNo,
            figureTargets,
          );
          try {
            return await llmService.call(
              stage2Prompt,
              undefined,
              [signedUrl],
              stage2BoundingBoxRootJsonSchema,
            );
          } catch (error) {
            if (error instanceof RateLimitError) {
              log.error("Rate limit error in stage 2", {
                message: error.message,
                model: error.model,
                provider: error.llmProvider,
                retryAfterMs: error.retryAfterMs,
              }, error);
              throw new RetryAfterError(error.message, error.retryAfterMs);
            }
            log.error("Unexpected LLM error in stage 2", {}, error);
            throw error;
          }
        });

        log.debug("Stage-2 raw output received", {
          outputLength: stage2Raw?.length ?? 0,
          outputPreview: stage2Raw?.slice(0, 500),
          figureTargets: figureTargets.length,
        });

        const stage2Parsed = parseStage2BoundingBoxes(stage2Raw);

        if (!stage2Parsed.survivedValidation) {
          const detail =
            stage2Parsed.validationErrors?.join("; ") ||
            "Stage-2 bounding box schema validation failed";
          log.error("Stage-2 structured OCR validation failed", {
            validationErrors: stage2Parsed.validationErrors,
            entityIndex: stage2Parsed.entityIndex,
            rawOutput: stage2Raw?.slice(0, 2000),
            attempt,
          }, new OcrValidationError(
            `Stage-2 bounding box extraction failed for page ${pageNo}: ${detail}`,
            {
              validationErrors: stage2Parsed.validationErrors,
              pageNo,
              attempt,
              stage: "stage-2",
              rawOutput: stage2Raw ?? undefined,
              entityIndex: stage2Parsed.entityIndex,
            },
          ));

          if (attempt < TOTAL_RETRIES) {
            throw new OcrValidationError(
              `Stage-2 bounding box extraction failed for page ${pageNo} (attempt ${attempt + 1}/${TOTAL_RETRIES + 1}): ${detail}`,
              {
                validationErrors: stage2Parsed.validationErrors,
                pageNo,
                attempt,
                stage: "stage-2",
                rawOutput: stage2Raw ?? undefined,
                entityIndex: stage2Parsed.entityIndex,
              },
            );
          }
          // Final attempt failed — non-retriable, cannot produce merged output.
          throw new NonRetriableError(
            `Stage-2 bounding box extraction failed on final attempt for page ${pageNo}: ${detail}`,
          );
        }

        // Strict merge — path mismatches are non-retriable.
        try {
          mergedData = mergeStage1AndStage2(
            stage1Data,
            stage2Parsed.parsedStructuredData!,
          );
        } catch (error) {
          if (error instanceof OcrMergeError) {
            log.error("Stage-1 / stage-2 merge failed", {
              message: error.message,
              stage: "merge",
            }, error);
            throw new NonRetriableError(error.message);
          }
          log.error("Unexpected merge error", {}, error);
          throw error;
        }
      }
    }

    const extraction = {
      rawText: stage1.rawText,
      ocrStatus: (stage1.rawText ? "completed" : "failed") as
        | "completed"
        | "failed",
      survivedValidation: stage1.survivedValidation && !!mergedData,
      isRelevant: stage1.isRelevant,
      isStartOpen: mergedData?.isStartOpen ?? stage1.isStartOpen,
      isEndOpen: mergedData?.isEndOpen ?? stage1.isEndOpen,
      parsedData: mergedData,
    };

    // 3. Persist the cleaned (not parsed) OCR text & validation result to the database in a dedicated step
    await step.run("update-page-ocr-result", async () => {
      await documentRepository.commands.updateFilePage(db, {
        pageId,
        fileId,
        pageNo,
        ocrText: extraction.rawText ?? undefined,
        ocrStatus: extraction.ocrStatus,
        ocrModel: llmService.model,
        survivedValidation: extraction.survivedValidation,
        isRelevant: extraction.isRelevant,
        fnVersion: OCR_FN_VERSION,
      });
    });

    // 4. Extract figures if validation survived and we have structured data with bounding boxes
    let extractedFigures: ExtractedFigure[] = [];
    if (extraction.survivedValidation && extraction.parsedData) {
      extractedFigures = await step.run(
        "extract-figures-from-page",
        async () => {
          return await extractFiguresFromPage(
            extraction.parsedData,
            signedUrl,
            pageNo,
            fileId,
            userId,
            documentId,
            fileName,
          );
        },
      );

      if (extractedFigures.length > 0) {
        log.info("Figure extraction complete for page", {
          figuresExtracted: extractedFigures.length,
        });
      }
    }

    log.info("Page OCR completed", {
      survivedValidation: extraction.survivedValidation,
      isRelevant: extraction.isRelevant,
      figuresExtracted: extractedFigures.length,
    });

    return {
      pageNo,
      pageId,
      fileId,
      rawText: extraction.rawText,
      survivedValidation: extraction.survivedValidation,
      status: extraction.ocrStatus,
      isRelevant: extraction.isRelevant,
      isStartOpen: extraction.isStartOpen,
      isEndOpen: extraction.isEndOpen,
      parsedData: extraction.parsedData,
      extractedFigures,
    };
  },
);

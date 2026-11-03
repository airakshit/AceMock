import { inngest } from "../../../client";
import { supabaseStorageClient } from "@/features/shared/storage-service";
import {
  buildStage2BoundingBoxPrompt,
  structuredTextExtractionPromptV2,
} from "./prompts";
import { documentRepository } from "@/features/documents/repositories/documents.repository";
import { db } from "@/db";
import { OcrPageResult } from "./types";
import { GeminiLLMService, GeminiModels } from "@/services/llm/gemini.service";
import {
  collectFiguresToExtract,
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
  type StructuredSchemaParseResult,
} from "./structured-question-schema";
import {
  partialOCRJsonSchema,
  stage2BoundingBoxRootJsonSchema,
  type PartialSchemaParseResult,
} from "./partial-schema";
import { env } from "@/config/env/server";
import { RateLimitError } from "@/services/llm/errors";
import { NonRetriableError, RetryAfterError } from "inngest";
import { FilePageOCRStatus } from "@/features/documents/types";
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
export const PAGE_OCR_EVENT = "v2/page/ocr";
export const OCR_FN_VERSION = 2;

export const ocrPage = inngest.createFunction(
  {
    id: "ocr-page-v2",
    triggers: { event: PAGE_OCR_EVENT },
    retries: TOTAL_RETRIES,
    concurrency: {
      limit: 3,
    },
  },

  async ({
    event,
    step,
    logger,
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

    // OpenRouter kept out of v2 OCR by decision — Gemini only.
    // The client implementation itself remains in src/services/llm/.
    const llmService = new GeminiLLMService(
      env.GEMINI_API_KEY,
      GeminiModels.GEMINI_3_5_FLASH_LITE,
    );

    // ---------------------------------------------------------------------
    // STAGE 1 — text / LaTeX extraction + hasFigure detection.
    // ---------------------------------------------------------------------
    const stage1 = await step.run(
      "llm-ocr-stage-1-text",
      async (): Promise<{
        rawText: string | null;
        survivedValidation: boolean;
        isRelevant: boolean;
        data?: PartialSchemaParseResult;
      }> => {
        let rawText: string | null = null;
        try {
          rawText = await llmService.call(
            structuredTextExtractionPromptV2,
            undefined,
            [signedUrl],
            partialOCRJsonSchema,
          );
          logger.debug("Stage-1 output:", {
            output: rawText,
            model: llmService.model,
          });
        } catch (error) {
          if (error instanceof RateLimitError) {
            logger.error("Rate limit error occurred", {
              message: error.message,
              cause: error.cause,
              retryingAfterSeconds: error.retryAfterMs / 1000,
              model: error.model,
              provider: error.llmProvider,
            });
            throw new RetryAfterError(error.message, error.retryAfterMs);
          }
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
        } = parsePartialStructuredOCR(rawText);

        if (!cleanedText && attempt < TOTAL_RETRIES) {
          throw new OcrEmptyResponseError(
            `No valid stage-1 response text could be extracted on page ${pageNo} (attempt ${attempt + 1}/${TOTAL_RETRIES + 1}).`,
          );
        }

        if (!survivedValidation && attempt < TOTAL_RETRIES) {
          logger.warn(
            { pageNo, pageId, attempt, validationErrors },
            `Stage-1 OCR validation failed for page ${pageNo} (attempt ${attempt + 1}/${TOTAL_RETRIES + 1}). Retrying...`,
          );
          throw new OcrValidationError(
            `Stage-1 structured OCR validation failed for page ${pageNo}: ${validationErrors?.join("; ") || "Schema validation failed"}`,
            { validationErrors, pageNo, attempt },
          );
        }

        if (!survivedValidation && validationErrors) {
          logger.warn(
            { pageNo, pageId, attempt, validationErrors },
            `Stage-1 OCR validation failed on final attempt for page ${pageNo}. Proceeding with best-effort text.`,
          );
        }

        let isRelevant = true;
        if (parsedStructuredData?.isRelevant !== undefined) {
          isRelevant = parsedStructuredData.isRelevant;
        }

        return {
          rawText: cleanedText,
          survivedValidation,
          isRelevant,
          data: parsedStructuredData,
        };
      },
    );

    // ---------------------------------------------------------------------
    // STAGE 2 — bounding-box extraction, only for items with hasFigure=true.
    // ---------------------------------------------------------------------
    let mergedData: StructuredSchemaParseResult | undefined;

    if (stage1.survivedValidation && stage1.data) {
      const figuresToExtract = collectFiguresToExtract(stage1.data);

      if (figuresToExtract.length === 0) {
        // No figures on this page — merge with an empty stage-2 result.
        mergedData = mergeStage1AndStage2(stage1.data, { items: [] });
      } else {
        const stage2Raw = await step.run("llm-ocr-stage-2-bbox", async () => {
          const stage2Prompt = buildStage2BoundingBoxPrompt(
            pageNo,
            figuresToExtract,
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
              logger.error("Rate limit error in stage 2", {
                message: error.message,
                model: error.model,
                provider: error.llmProvider,
              });
              throw new RetryAfterError(error.message, error.retryAfterMs);
            }
            throw error;
          }
        });

        logger.debug("Stage-2 output:", {
          output: stage2Raw,
          figuresRequested: figuresToExtract.length,
        });

        const stage2Parsed = parseStage2BoundingBoxes(stage2Raw);

        if (!stage2Parsed.survivedValidation) {
          const detail =
            stage2Parsed.validationErrors?.join("; ") ||
            "Stage-2 bounding box schema validation failed";
          if (attempt < TOTAL_RETRIES) {
            throw new OcrValidationError(
              `Stage-2 bounding box extraction failed for page ${pageNo} (attempt ${attempt + 1}/${TOTAL_RETRIES + 1}): ${detail}`,
              { validationErrors: stage2Parsed.validationErrors, pageNo, attempt },
            );
          }
          // Final attempt failed — non-retriable, cannot produce merged output.
          throw new NonRetriableError(
            `Stage-2 bounding box extraction failed on final attempt for page ${pageNo}: ${detail}`,
          );
        }

        // Strict merge — serial mismatches are non-retriable.
        try {
          mergedData = mergeStage1AndStage2(
            stage1.data,
            stage2Parsed.parsedStructuredData!,
          );
        } catch (error) {
          if (error instanceof OcrMergeError) {
            logger.error("Stage-1 / stage-2 merge failed", {
              pageNo,
              pageId,
              message: error.message,
            });
            throw new NonRetriableError(error.message);
          }
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
        logger.info(
          {
            documentId,
            fileId,
            pageNo,
            figuresExtracted: extractedFigures.length,
          },
          "Figure extraction complete for page.",
        );
      }
    }

    return {
      pageNo,
      pageId,
      fileId,
      rawText: extraction.rawText,
      survivedValidation: extraction.survivedValidation,
      status: extraction.ocrStatus,
      isRelevant: extraction.isRelevant,
      parsedData: extraction.parsedData,
      extractedFigures,
    };
  },
);

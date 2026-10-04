import { inngest } from "../../client";
import { supabaseStorageClient } from "@/features/shared/storage-service";
import {
  structuredOutputExtractionPrompt,
  structuredOutputExtractionPromptV2,
  structuredOutputExtractionPromptV3,
} from "@/services/llm/prompts";
import { documentsRepository } from "@/features/documents/repositories/documents.repository";
import { db } from "@/db";
import { OcrPageResult } from "./types";
import {
  OpenRouterLLMService,
  OpenRouterModels,
} from "@/services/llm/openrouter.service";
import { GeminiLLMService, GeminiModels } from "@/services/llm/gemini.service";
import { parseAndValidateStructuredOCR } from "./utils";
import { OcrValidationError, OcrEmptyResponseError } from "./errors";
import {
  type StructuredSchemaParseResult,
  structuredOCRJsonSchema,
} from "./structured-question-schema";
import { env } from "@/config/env/server";
import { RateLimitError } from "@/services/llm/errors";
import { RetryAfterError } from "inngest";
import { FilePageOCRStatus } from "@/features/documents/types";

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

export const ocrPage = inngest.createFunction(
  {
    id: "ocr-page",
    triggers: { event: "page/ocr" },
    retries: TOTAL_RETRIES,
    concurrency: {
      limit: 2,
    },
  },

  async ({ event, step, logger, attempt }): Promise<OcrPageResult> => {
    const data = event.data as OcrPageEventData;
    const { fileId, pageId, pageNo, storagePath } = data;

    // 0. Update file page status to "running"
    await step.run("update-file-ocr-status", async () => {
      await documentsRepository.updateFilePageStatusByPageId(db, pageId, "running" as FilePageOCRStatus);
    });

    // 1. Generate a signed URL for the page image in Supabase storage
    const signedUrl = await step.run("get-page-access-url", async () => {
      return await supabaseStorageClient.getPageAccessUrl(storagePath);
    });

    // const llmService = new GeminiLLMService(
    //   env.GEMINI_API_KEY,
    //   GeminiModels.GEMINI_3_FLASH,
    // );
    const llmService = new OpenRouterLLMService(
      env.OPENROUTER_API_KEY!,
      OpenRouterModels.DOTS_3_NOTE_PREVIEW,
    );
    const extraction = await step.run(
      "llm-ocr-extraction",
      async (): Promise<{
        rawText: string | null;
        ocrStatus: "completed" | "failed";
        survivedValidation: boolean;
        isRelevant: boolean;
        parsedData?: StructuredSchemaParseResult;
      }> => {
        let rawText: string | null = null;
        try {
          rawText = await llmService.call(
            structuredOutputExtractionPromptV3,
            undefined,
            [signedUrl],
            structuredOCRJsonSchema,
          );
          logger.debug("Output is : ", {
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
            `No response returned by LLM on page ${pageNo} (attempt ${attempt + 1}/${TOTAL_RETRIES + 1}).`,
          );
        }

        const {
          cleanedText,
          survivedValidation,
          validationErrors,
          parsedStructuredData,
        } = parseAndValidateStructuredOCR(rawText);

        if (!cleanedText && attempt < TOTAL_RETRIES) {
          throw new OcrEmptyResponseError(
            `No valid response text could be extracted from LLM on page ${pageNo} (attempt ${attempt + 1}/${TOTAL_RETRIES + 1}).`,
          );
        }

        // Retry on validation failure if retries are not exhausted
        if (!survivedValidation && attempt < TOTAL_RETRIES) {
          logger.warn(
            {
              pageNo,
              pageId,
              attempt,
              validationErrors,
            },
            `Structured OCR validation failed for page ${pageNo} (attempt ${attempt + 1}/${TOTAL_RETRIES + 1}). Retrying page OCR...`,
          );
          throw new OcrValidationError(
            `Structured OCR validation failed for page ${pageNo}: ${validationErrors?.join("; ") || "Schema validation failed"}`,
            { validationErrors, pageNo, attempt },
          );
        }

        if (!survivedValidation && validationErrors) {
          logger.warn(
            {
              pageNo,
              pageId,
              attempt,
              validationErrors,
            },
            `Structured OCR validation failed on final attempt for page ${pageNo}. Proceeding with best-effort text.`,
          );
        }

        const ocrStatus: "completed" | "failed" = cleanedText
          ? "completed"
          : "failed";

        let isRelevant: boolean = true;

        if (!(parsedStructuredData?.isRelevant === undefined)) {
          isRelevant = parsedStructuredData.isRelevant;
        }

        return {
          rawText: cleanedText,
          isRelevant: isRelevant,
          ocrStatus,
          survivedValidation,
          parsedData: parsedStructuredData,
        };
      },
    );

    // 3. Persist the cleaned (not parsed) OCR text & validation result to the database in a dedicated step
    await step.run("update-page-ocr-result", async () => {
      await documentsRepository.updateFilePage(db, {
        pageId,
        fileId,
        pageNo,
        ocrText: extraction.rawText ?? undefined,
        ocrStatus: extraction.ocrStatus,
        ocrModel: llmService.model,
        survivedValidation: extraction.survivedValidation,
        isRelevant: extraction.isRelevant,
      });
    });

    return {
      pageNo,
      pageId,
      fileId,
      rawText: extraction.rawText,
      survivedValidation: extraction.survivedValidation,
      status: extraction.ocrStatus,
      isRelevant: extraction.isRelevant,
      parsedData: extraction.parsedData,
    };
  },
);

import { inngest } from "../../client";
import { supabaseStorageClient } from "@/features/shared/storage-service";
import {
  paperTextStructuredExtractionPromptV1,
  paperTextStructuredExtractionPromptV2,
} from "@/services/llm/prompts";
import { filePagesRepository } from "@/features/documents/repositories/file-pages.repository";
import { db } from "@/db";
import type { OcrPageResult } from "./ocr-types";
import { OpenRouterLLMService, OpenRouterModels } from "@/services/llm";
import { parseAndValidateStructuredOCR } from "./utils";

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
      limit: 3,
    },
  },

  async ({ event, step, logger, attempt }): Promise<OcrPageResult> => {
    const data = event.data as OcrPageEventData;
    const { fileId, pageId, pageNo, storagePath } = data;

    // 0. Update file page status to "ocr"
    await step.run("update-file-ocr-status", async () => {
      await filePagesRepository.updateStatusByPageId(db, pageId, "ocr");
    });

    // 1. Generate a signed URL for the page image in Supabase storage
    const signedUrl = await step.run("get-page-access-url", async () => {
      return await supabaseStorageClient.getPageAccessUrl(storagePath);
    });

    const MODEL_TO_USE = OpenRouterModels.FREE_VISION.MINIMAX_M3;

    // 2. Send image to LLM for raw OCR text transcription & validation
    const extraction = await step.run(
      "llm-ocr-extraction",
      async (): Promise<{
        rawText: string | null;
        ocrStatus: "success" | "failed";
        survivedValidation: boolean;
        isRelevant: boolean;
      }> => {
        const openRouter = new OpenRouterLLMService(
          process.env.OPENROUTER_API_KEY!,
          MODEL_TO_USE,
        );

        const rawText = await openRouter.call(
          paperTextStructuredExtractionPromptV2,
          undefined,
          [signedUrl],
        );

        if (!rawText && attempt !== TOTAL_RETRIES) {
          throw new Error("No response returned by LLM.");
        }

        const {
          cleanedText,
          survivedValidation,
          validationErrors,
          parsedStructuredData,
        } = parseAndValidateStructuredOCR(rawText);

        if (!cleanedText && attempt !== TOTAL_RETRIES) {
          throw new Error(
            "No valid response text could be extracted from LLM.",
          );
        }

        if (!survivedValidation && validationErrors) {
          logger.warn(
            {
              pageNo,
              pageId,
              validationErrors,
            },
            `Structured OCR validation failed for page ${pageNo}`,
          );
        }

        const ocrStatus: "success" | "failed" = cleanedText
          ? "success"
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
        };
      },
    );

    // 3. Persist the cleaned (not parsed) OCR text & validation result to the database in a dedicated step
    await step.run("update-page-ocr-result", async () => {
      await filePagesRepository.update(db, pageId, fileId, {
        pageNo,
        ocrText: extraction.rawText ?? undefined,
        ocrStatus: extraction.ocrStatus,
        ocrModel: MODEL_TO_USE,
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
    };
  },
);

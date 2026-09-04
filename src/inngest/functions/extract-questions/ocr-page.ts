import { inngest } from "../../client";
import { RetryAfterError } from "inngest";
import { supabaseStorageClient } from "@/features/shared/storage-service";
import { GroqLLMService, GroqModels } from "@/services/llm/llm.service";
import { paperTextExtractionPrompt } from "@/services/llm/prompts";
import { env } from "@/config/env/server";
import { filePagesRepository } from "@/features/documents/repositories/file-pages.repository";
import { db } from "@/db";
import { getGroqRateLimitDelayMs } from "@/services/llm/rate-limit";
import type { OcrPageResult } from "./ocr-types";
import { OpenRouterLLMService, OpenRouterModels } from "@/services/llm";

export interface OcrPageEventData {
  userId: string;
  documentId: string;
  fileId: string;
  fileName: string;
  pageId: string;
  pageNo: number;
  storagePath: string;
}

export const ocrPage = inngest.createFunction(
  {
    id: "ocr-page",
    triggers: { event: "page/ocr" },
    retries: 10,
    concurrency: {
      limit: 1, // Enforce sequential execution across pages to respect Groq TPM quota
    },
  },

  async ({ event, step, logger }) => {
    const data = event.data as OcrPageEventData;
    const { fileId, pageId, pageNo, storagePath } = data;

    // 1. Generate a signed URL for the page image in Supabase storage
    const signedUrl = await step.run("get-page-access-url", async () => {
      return await supabaseStorageClient.getPageAccessUrl(storagePath);
    });

    // 2. Send image to LLM for raw OCR text transcription
    const result = await step.run("llm-ocr-extraction", async () => {
      const openRouter = new OpenRouterLLMService(
        process.env.OPENROUTER_API_KEY!,
        OpenRouterModels.FREE_VISION.DOTS_3_NOTE_PREVIEW,
      );
      const rawText = await openRouter.call(
        paperTextExtractionPrompt,
        undefined,
        [signedUrl],
      );


      // const groqService = new GroqLLMService(
      //   env.GROQ_API_KEY,
      //   GroqModels.QWEN_VISION_MODEL,
      // );

      // let rawText: string | null = null;
      // try {
      //   rawText = await groqService.call(
      //     paperTextExtractionPrompt,
      //     undefined,
      //     [signedUrl],
      //   );
      // } catch (err: unknown) {
      //   const delayMs = getGroqRateLimitDelayMs(err);
      //   if (delayMs !== null) {
      //     const seconds = Math.ceil(delayMs / 1000);
      //     logger.warn(
      //       {
      //         pageNo,
      //         delayMs,
      //         retryAfterSeconds: seconds,
      //       },
      //       `Groq rate limit (429) encountered. Retrying step in ${seconds}s as specified in headers...`,
      //     );
      //     throw new RetryAfterError(
      //       `Groq rate limit exceeded on page ${pageNo}. Retrying in ${seconds}s`,
      //       delayMs,
      //       { cause: err },
      //     );
      //   }
      //   throw err;
      // }

      // Remove reasoning model <think>...</think> tags if present
      const cleanedText = rawText
        ? rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim()
        : null;

      const ocrStatus = cleanedText ? "success" : "failed";

      // Persist the raw OCR text to the database
      await filePagesRepository.update(db, pageId, fileId, {
        pageNo,
        ocrText: cleanedText ?? undefined,
        ocrStatus,
      });

      return {
        pageNo,
        pageId,
        fileId,
        rawText: cleanedText,
        status: ocrStatus,
      };
    });

    return result;
  },
);

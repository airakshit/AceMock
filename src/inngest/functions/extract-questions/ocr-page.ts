import { inngest } from "../../client";
import { RetryAfterError } from "inngest";
import { supabaseStorageClient } from "@/features/shared/storage-service";
import { paperTextExtractionPrompt, paperTextStructuredExtractionPrompt } from "@/services/llm/prompts";
import { env } from "@/config/env/server";
import { filePagesRepository } from "@/features/documents/repositories/file-pages.repository";
import { db } from "@/db";
import type { OcrPageResult } from "./ocr-types";
import { OpenRouterLLMService, OpenRouterModels } from "@/services/llm";
import { structuredOCRExtractionSchema } from "./schema";

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
      limit: 3, // Enforce sequential execution across pages to respect TPM quota
    },
  },

  async ({ event, step, logger, attempt }) => {
    const data = event.data as OcrPageEventData;
    const { fileId, pageId, pageNo, storagePath } = data;

    await step.run('update-file-ocr-status', async () => {
      await filePagesRepository.updateStatusByPageId(db, pageId, "ocr")
    })

    // 1. Generate a signed URL for the page image in Supabase storage
    const signedUrl = await step.run("get-page-access-url", async () => {
      return await supabaseStorageClient.getPageAccessUrl(storagePath);
    });

    const MODEL_TO_USE = OpenRouterModels.FREE_VISION.DOTS_3_NOTE_PREVIEW;

    // 2. Send image to LLM for raw OCR text transcription
    const result = await step.run("llm-ocr-extraction", async () => {
      const openRouter = new OpenRouterLLMService(
        process.env.OPENROUTER_API_KEY!,
        MODEL_TO_USE,
      );
      const rawText = await openRouter.call(
        paperTextStructuredExtractionPrompt,
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

      // Remove reasoning model <think>...</think> and ```json tags if present

      if (!rawText) {
        if (attempt != TOTAL_RETRIES) throw Error("No response returned by LLM.")
      }

      const cleanedText = rawText ? rawText
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/^```json\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim() : null;

      const ocrStatus = cleanedText ? "success" : "failed";

      if (!cleanedText && attempt != TOTAL_RETRIES) throw Error("No response returned by LLM.")

      let survivedValidation: boolean = false;

      if (cleanedText) {
        const result = structuredOCRExtractionSchema.safeParse(
          JSON.parse(cleanedText)
        );
        survivedValidation = result.success;
      }

      // Persist the raw OCR text to the database
      await filePagesRepository.update(db, pageId, fileId, {
        pageNo,
        ocrText: cleanedText ? cleanedText : undefined,
        ocrStatus,
        ocrModel: MODEL_TO_USE,
        survivedValidation: survivedValidation
      });

      return {
        pageNo,
        pageId,
        fileId,
        rawText: cleanedText,
        surviesValidation: survivedValidation,
        status: ocrStatus,
      };
    });

    return result;
  },
);

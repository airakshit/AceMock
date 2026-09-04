import { db } from "@/db";
import { inngest } from "../../client";
import { documentQueries } from "@/features/documents/repositories/document-queries";
import { storagePaths } from "@/lib/supabase/storage-paths";
import { FullDocumentResult } from "@/features/documents/repositories/types";
import { JsonifyObject } from "inngest/types";
import { ocrPage } from "./ocr-page";
import { documentsRepository } from "@/features/documents/repositories/documents.repository";
import type { OcrPageResult } from "./ocr-types";

export interface ExtractDocumentQuestionEventData {
  userId: string;
  documentId: string;
}

export const EXTRACT_QUESTIONS_EVENT = "documents/extract" as const;

export const extractQuestions = inngest.createFunction(
  {
    id: "extract-questions-from-document",
    triggers: { event: EXTRACT_QUESTIONS_EVENT },
  },

  async ({ step, logger, event }) => {
    const eventData = event.data as ExtractDocumentQuestionEventData;
    const { documentId, userId } = eventData;

    // 1. Fetch document pages metadata
    const docData: JsonifyObject<FullDocumentResult> = await step.run(
      "fetch-document-pages",
      async () => {
        return await documentQueries.getDocumentWithPages(db, documentId, userId);
      },
    );

    if (!docData || !docData.files || docData.files.length === 0) {
      return {
        success: true,
        message: "No files found for document.",
        documentId,
        results: [],
      };
    }

    await step.run(
      "mark-documents-as-extracting-questions",
      async () => {
        await documentsRepository.update(db, docData.documentId, userId, { status: "extracting_questions" })
      }
    )

    // Collect all pages across all files for fan-out
    const pagesToProcess: Array<{
      fileId: string;
      fileName: string;
      pageId: string;
      pageNo: number;
      storagePath: string;
    }> = [];

    docData.files.forEach((file) => {
      file.pages.forEach((page) => {
        if (page.ocrStatus != "success") {

          const pageStoragePath = storagePaths.getDocumentFilePageSourceUrl(
            userId,
            documentId,
            file.fileId,
            file.fileName,
            "webp",
            page.pageNo,
          );
          pagesToProcess.push({
            fileId: file.fileId,
            fileName: file.fileName,
            pageId: page.id,
            pageNo: page.pageNo,
            storagePath: pageStoragePath,
          });
        }
      });
    });

    if (pagesToProcess.length === 0) {
      return {
        success: true,
        message: "No pages found to OCR.",
        documentId,
        results: [],
      };
    }

    // 2. Fan-Out & Fan-In: OCR every page to raw text
    const ocrResults: OcrPageResult[] = (await Promise.all(
      pagesToProcess.map((item) =>
        step.invoke(`ocr-page-${item.pageId}`, {
          function: ocrPage,
          data: {
            userId,
            documentId,
            fileId: item.fileId,
            fileName: item.fileName,
            pageId: item.pageId,
            pageNo: item.pageNo,
            storagePath: item.storagePath,
          },
        }),
      ),
    )) as OcrPageResult[];

    logger.info(
      {
        documentId,
        totalPages: pagesToProcess.length,
        successfulPages: ocrResults.filter((r) => r.status === "success").length,
      },
      "Raw OCR extraction completed for all pages.",
    );

    // 3. Mark document as completed
    await step.run("mark-document-completed", async () => {
      await documentsRepository.updateProcessingStatus(db, documentId, "success");
    });

    return {
      success: true,
      documentId,
      totalPages: pagesToProcess.length,
      results: ocrResults,
    };
  },
);

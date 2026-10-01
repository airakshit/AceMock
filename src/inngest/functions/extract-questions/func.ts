import { db } from "@/db";
import { inngest } from "../../client";
import { documentQueries } from "@/features/documents/repositories/document-queries";
import { storagePaths } from "@/lib/supabase/storage-paths";
import { FullDocumentResult } from "@/features/documents/repositories/types";
import { JsonifyObject } from "inngest/types";

import { documentsRepository } from "@/features/documents/repositories/documents.repository";
import {
  questionsRepository,
  type CreateQuestionItem,
} from "@/features/questions/repositories/questions.repository";
import { generateUUIDv7 } from "@/features/shared/utils";
import { mergeOcrResults } from "./merge-ocr-results";
import type { ResolvedQuestion } from "./types";
import { QuestionPersistError } from "./errors";
import { ocrPage, OcrPageResult, OcrPageFailedError } from "../ocr-page";

export interface ExtractDocumentQuestionEventData {
  userId: string;
  documentId: string;
}

export const EXTRACT_QUESTIONS_EVENT = "documents/extract" as const;

export const extractQuestions = inngest.createFunction(
  {
    id: "extract-questions-from-document",
    triggers: { event: EXTRACT_QUESTIONS_EVENT },
    onFailure: async ({ event, step, logger }) => {
      const eventData = (event.data as any)?.event?.data as
        | ExtractDocumentQuestionEventData
        | undefined;
      const documentId = eventData?.documentId;

      if (documentId) {
        logger.error(
          { documentId },
          "Extract questions workflow failed permanently. Marking document as failed.",
        );
        await step.run("mark-document-failed-on-error", async () => {
          await documentsRepository.updateProcessingStatus(
            db,
            documentId,
            "failed",
          );
        });
      }
    },
  },

  async ({ step, logger, event }) => {
    const eventData = event.data as ExtractDocumentQuestionEventData;
    const { documentId, userId } = eventData;

    // 1. Fetch document files and pages metadata from the database
    const docData: JsonifyObject<FullDocumentResult> = await step.run(
      "fetch-document-pages",
      async () => {
        return await documentQueries.getDocumentWithPages(
          db,
          documentId,
          userId,
        );
      },
    );

    if (!docData || !docData.files || docData.files.length === 0) {
      await step.run("mark-document-failed-no-files", async () => {
        await documentsRepository.updateProcessingStatus(
          db,
          documentId,
          "failed",
        );
      });

      return {
        success: false,
        message: "No files found for document.",
        documentId,
        results: [],
      };
    }

    // Collect all pages across all files for this document
    const allDocPages: Array<{
      fileId: string;
      fileName: string;
      pageId: string;
      pageNo: number;
      ocrStatus: string;
      ocrText: string | null;
      survivedValidation: boolean;
      isRelevant: boolean;
      storagePath: string;
    }> = [];

    docData.files.forEach((file) => {
      file.pages.forEach((page) => {
        const pageStoragePath = storagePaths.getDocumentFilePageSourceUrl(
          userId,
          documentId,
          file.fileId,
          file.fileName,
          "webp",
          page.pageNo,
        );
        allDocPages.push({
          fileId: file.fileId,
          fileName: file.fileName,
          pageId: page.id,
          pageNo: page.pageNo,
          ocrStatus: page.ocrStatus,
          ocrText: page.ocrText,
          survivedValidation: page.survivedValidation,
          isRelevant: page.isRelevant,
          storagePath: pageStoragePath,
        });
      });
    });

    if (allDocPages.length === 0) {
      await step.run("mark-document-failed-no-pages", async () => {
        await documentsRepository.updateProcessingStatus(
          db,
          documentId,
          "failed",
        );
      });

      return {
        success: false,
        message: "No pages found for document.",
        documentId,
        results: [],
      };
    }

    // 2. Step-Level Retry Detection & Page Filtering
    // If the document is already in merging_questions or all pages are completed, skip OCR step completely
    const isAlreadyInMerging = docData.processingStatus === "merging_questions";

    const pagesToProcess = allDocPages.filter((page) => {
      const isAlreadyCompleted =
        page.ocrStatus === "completed" &&
        page.ocrText !== null &&
        page.ocrText.trim().length > 0 &&
        page.survivedValidation !== false;

      return !isAlreadyCompleted;
    });

    const newResultsMap = new Map<string, OcrPageResult>();

    if (isAlreadyInMerging && pagesToProcess.length === 0) {
      logger.info(
        { documentId, totalDocPages: allDocPages.length },
        "Document is already in merging_questions state with all pages completed. Skipping OCR and resuming directly from merging step.",
      );
    } else if (pagesToProcess.length > 0) {
      logger.info(
        {
          documentId,
          totalDocPages: allDocPages.length,
          pagesToProcess: pagesToProcess.length,
          alreadyCompleted: allDocPages.length - pagesToProcess.length,
        },
        "Processing pending/failed pages for OCR.",
      );

      await step.run("mark-documents-as-extracting-questions", async () => {
        await documentsRepository.updateProcessingStatus(
          db,
          documentId,
          "extracting_questions",
        );
      });

      // Fan-Out & Fan-In: OCR only the remaining pages
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

      ocrResults.forEach((res) => {
        newResultsMap.set(res.pageId, res);
      });
    } else {
      logger.info(
        { documentId, totalDocPages: allDocPages.length },
        "All pages already completed OCR. Proceeding directly to merge.",
      );
    }

    // 3. Assemble the full set of OCR results across ALL pages of the document
    const allOcrResults: OcrPageResult[] = allDocPages.map((page) => {
      const newlyProcessed = newResultsMap.get(page.pageId);
      if (newlyProcessed) {
        return newlyProcessed;
      }

      return {
        pageNo: page.pageNo,
        pageId: page.pageId,
        fileId: page.fileId,
        rawText: page.ocrText,
        status: (page.ocrStatus === "completed" ? "completed" : "failed") as
          | "completed"
          | "failed",
        survivedValidation: page.survivedValidation,
        isRelevant: page.isRelevant,
      };
    });

    // 4. Validate that ALL pages across the entire document succeeded
    const failedPages = allOcrResults.filter(
      (r) =>
        r.status !== "completed" || !r.rawText || r.rawText.trim().length === 0,
    );

    if (failedPages.length > 0) {
      logger.warn(
        {
          documentId,
          totalDocPages: allDocPages.length,
          failedCount: failedPages.length,
          failedPages: failedPages.map((p) => ({
            pageId: p.pageId,
            pageNo: p.pageNo,
          })),
        },
        "Not all pages succeeded OCR. Marking document as failed and halting before merging.",
      );

      await step.run("mark-document-failed-incomplete-pages", async () => {
        await documentsRepository.updateProcessingStatus(
          db,
          documentId,
          "failed",
        );
      });

      throw new OcrPageFailedError(
        failedPages[0].pageId,
        failedPages[0].pageNo,
        `${failedPages.length} out of ${allDocPages.length} pages failed OCR. Merging aborted.`,
      );
    }

    // 5. All pages are successful! Ensure status is merging_questions and perform merging
    await step.run("mark-document-merging-questions", async () => {
      await documentsRepository.updateProcessingStatus(
        db,
        documentId,
        "merging_questions",
      );
    });

    const resolvedQuestions: ResolvedQuestion[] = await step.run(
      "merge-ocr-questions",
      async () => {
        return mergeOcrResults(allOcrResults);
      },
    );

    logger.info(
      {
        documentId,
        totalDocPages: allDocPages.length,
        totalResolvedQuestions: resolvedQuestions.length,
      },
      "All pages merged and questions resolved successfully.",
    );

    if (resolvedQuestions.length === 0) {
      logger.warn(
        { documentId },
        "No valid questions could be resolved from OCR output.",
      );

      await step.run("mark-document-completed-zero-questions", async () => {
        await documentsRepository.updateProcessingStatus(
          db,
          documentId,
          "completed",
        );
      });

      return {
        success: true,
        documentId,
        totalPages: allDocPages.length,
        totalQuestionsSaved: 0,
        message: "No questions found in document.",
      };
    }

    // 6. Resolve chapters per subject and persist passages
    const passageMap = await step.run("create-passages", async () => {
      const passageMap: Record<string, string> = {};

      const distinctPassages = Array.from(
        new Set(
          resolvedQuestions
            .map((q) => q.passageContent?.trim())
            .filter((p): p is string => Boolean(p)),
        ),
      );
      const results = await questionsRepository.createManyPassages(
        db,
        distinctPassages,
      );
      for (const result of results) {
        passageMap[result.content] = result.id;
      }
      return passageMap;
    });

    const saveResult = await step.run("save-questions", async () => {
      try {
        const payload: CreateQuestionItem[] = resolvedQuestions.map((q) => {
          const passageId = q.passageContent
            ? passageMap[q.passageContent.trim()] || null
            : null;

          return {
            id: generateUUIDv7(),
            chapterId: null,
            passageId,
            fileId: q.fileId,
            question: q.question,
            options: q.options,
            correctOption: q.correctOption,
            marks: q.marks,
            difficulty: q.difficulty,
            questionDiagram: q.diagram_url ?? null,
            hint: q.hint ?? null,
            solution: q.solution ?? null,
            solutionDiagram: q.solution_diagram_url ?? null,
          };
        });

        const inserted = await questionsRepository.createMany(db, payload);
        return {
          savedCount: inserted.length,
          insertedQuestions: inserted.map((q, idx) => ({
            id: q.id,
            question: q.question,
            options: q.options as Array<{ key: string; text: string }>,
            subject: resolvedQuestions[idx]?.subject || null,
            passageContent: resolvedQuestions[idx]?.passageContent || null,
          })),
        };
      } catch (err) {
        logger.error(
          { documentId, error: err },
          "Failed to save resolved questions to database.",
        );
        throw new QuestionPersistError(
          `Failed to persist questions to database: ${err instanceof Error ? err.message : String(err)}`,
          err,
        );
      }
    });

    await step.run("mark-document-completed", async () => {
      await documentsRepository.updateProcessingStatus(
        db,
        documentId,
        "completed",
      );
    });
  },
);

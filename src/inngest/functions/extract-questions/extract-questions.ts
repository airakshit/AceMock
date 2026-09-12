import { db } from "@/db";
import { inngest } from "../../client";
import { documentQueries } from "@/features/documents/repositories/document-queries";
import { storagePaths } from "@/lib/supabase/storage-paths";
import { FullDocumentResult } from "@/features/documents/repositories/types";
import { JsonifyObject } from "inngest/types";
import { ocrPage } from "./ocr-page";
import { documentsRepository } from "@/features/documents/repositories/documents.repository";
import {
  questionsRepository,
  type CreateQuestionItem,
} from "@/features/questions/repositories/questions.repository";
import { generateUUIDv7 } from "@/features/shared/utils";
import { mergeOcrResults } from "./merge-ocr-results";
import type { OcrPageResult, ResolvedQuestion } from "./ocr-types";
import { OcrPageFailedError, QuestionPersistError } from "./errors";

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
      const eventData = (event.data as any)?.event
        ?.data as ExtractDocumentQuestionEventData | undefined;
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

    // 1. Fetch document pages metadata
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

    await step.run("mark-documents-as-extracting-questions", async () => {
      await documentsRepository.updateProcessingStatus(
        db,
        documentId,
        "extracting_questions",
      );
    });

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
        if (page.ocrStatus !== "success") {
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
      // Check if all pages already succeeded previously
      logger.info({ documentId }, "No pending pages found to OCR.");
      await step.run("mark-document-completed-no-pending-pages", async () => {
        await documentsRepository.updateProcessingStatus(
          db,
          documentId,
          "success",
        );
      });

      return {
        success: true,
        message: "No pages found to OCR.",
        documentId,
        results: [],
      };
    }

    // 2. Fan-Out & Fan-In: OCR every page to raw text & structured data
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

    const successfulPages = ocrResults.filter((r) => r.status === "success");

    logger.info(
      {
        documentId,
        totalPages: pagesToProcess.length,
        successfulPages: successfulPages.length,
      },
      "Raw OCR extraction completed for all pages.",
    );

    if (successfulPages.length === 0) {
      await step.run("mark-document-failed-all-pages-failed", async () => {
        await documentsRepository.updateProcessingStatus(
          db,
          documentId,
          "failed",
        );
      });

      throw new OcrPageFailedError(
        pagesToProcess[0]?.pageId ?? "unknown",
        pagesToProcess[0]?.pageNo ?? 1,
        "All pages failed OCR processing.",
      );
    }

    // 3. Merge extracted data across pages (resolves questions, solutions, answer keys, split entities)
    const resolvedQuestions: ResolvedQuestion[] = await step.run(
      "merge-ocr-questions",
      async () => {
        return mergeOcrResults(ocrResults);
      },
    );

    logger.info(
      {
        documentId,
        totalResolvedQuestions: resolvedQuestions.length,
      },
      "Questions merged and resolved successfully.",
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
          "success",
        );
      });

      return {
        success: true,
        documentId,
        totalPages: pagesToProcess.length,
        totalQuestionsSaved: 0,
        message: "No questions found in document.",
      };
    }

    // 4. Resolve chapters per subject and persist passages
    const { chapterMap, passageMap } = await step.run(
      "resolve-chapters-and-passages",
      async () => {
        const chapterMap: Record<string, string> = {};
        const passageMap: Record<string, string> = {};

        // Find or create default chapters for each unique subject
        const distinctSubjects = Array.from(
          new Set(
            resolvedQuestions.map((q) =>
              (q.subject || "general").toLowerCase().trim(),
            ),
          ),
        );

        for (const subject of distinctSubjects) {
          const chapterId =
            await questionsRepository.findOrCreateDefaultChapter(db, subject);
          chapterMap[subject] = chapterId;
        }

        // Find or create passages for comprehension questions
        const distinctPassages = Array.from(
          new Set(
            resolvedQuestions
              .map((q) => q.passageContent?.trim())
              .filter((p): p is string => Boolean(p)),
          ),
        );

        for (const passageContent of distinctPassages) {
          const passageId = await questionsRepository.createPassage(
            db,
            passageContent,
          );
          passageMap[passageContent] = passageId;
        }

        return { chapterMap, passageMap };
      },
    );

    // 5. Prepare payload and persist all questions to the database
    const savedCount = await step.run("save-questions", async () => {
      try {
        const defaultSubjectKey = "general";
        const fallbackChapterId =
          chapterMap[defaultSubjectKey] ||
          Object.values(chapterMap)[0] ||
          (await questionsRepository.findOrCreateDefaultChapter(db, "general"));

        const payload: CreateQuestionItem[] = resolvedQuestions.map((q) => {
          const subjectKey = (q.subject || "general").toLowerCase().trim();
          const chapterId = chapterMap[subjectKey] || fallbackChapterId;
          const passageId = q.passageContent
            ? passageMap[q.passageContent.trim()] || null
            : null;

          return {
            id: generateUUIDv7(),
            chapterId,
            passageId,
            fileId: q.fileId,
            question: q.question,
            options: q.options,
            correctOption: q.correctOption,
            marks: q.marks,
            difficulty: q.difficulty,
            diagram_url: q.diagram_url ?? null,
            hint: q.hint ?? null,
            solution: q.solution ?? null,
            solution_diagram_url: q.solution_diagram_url ?? null,
          };
        });

        const inserted = await questionsRepository.createMany(db, payload);
        return inserted.length;
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

    // 6. Mark document as successfully processed
    await step.run("mark-document-completed", async () => {
      await documentsRepository.updateProcessingStatus(
        db,
        documentId,
        "success",
      );
    });

    logger.info(
      {
        documentId,
        totalQuestionsSaved: savedCount,
      },
      "Document processing and question extraction completed successfully.",
    );

    return {
      success: true,
      documentId,
      totalPages: pagesToProcess.length,
      successfulPages: successfulPages.length,
      totalQuestionsSaved: savedCount,
    };
  },
);

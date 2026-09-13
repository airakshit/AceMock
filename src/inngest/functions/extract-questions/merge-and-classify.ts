import { db } from "@/db";
import { inngest } from "../../client";
import { documentQueries } from "@/features/documents/repositories/document-queries";
import { FullDocumentResult } from "@/features/documents/repositories/types";
import { JsonifyObject } from "inngest/types";
import { documentsRepository } from "@/features/documents/repositories/documents.repository";
import {
  questionsRepository,
  type CreateQuestionItem,
} from "@/features/questions/repositories/questions.repository";
import { generateUUIDv7 } from "@/features/shared/utils";
import { mergeOcrResults } from "./merge-ocr-results";
import type { OcrPageResult, ResolvedQuestion } from "./ocr-types";
import { QuestionMergeError, QuestionPersistError } from "./errors";
import { curriculumClassifierService } from "@/features/questions/services/curriculum-classifier.service";

export interface InternalMergeAndClassifyEventData {
  userId: string;
  documentId: string;
  /**
   * If true (default), removes any previously persisted questions for this document's files
   * before re-merging and re-classifying, ensuring an idempotent re-run.
   */
  cleanExisting?: boolean;
}

export const INTERNAL_MERGE_AND_CLASSIFY_EVENT =
  "internal/documents.merge-and-classify" as const;

/**
 * Internal Inngest function that takes documentId and userId and runs
 * the post-OCR pipeline (Question Merging, Passage Assignment, DB Persistence, and Curriculum Classification)
 * without re-running OCR on the page images.
 *
 * Useful for re-running merging and classification logic, debugging, or admin triggers.
 */
export const internalMergeAndClassify = inngest.createFunction(
  {
    id: "internal-merge-and-classify-questions",
    triggers: { event: INTERNAL_MERGE_AND_CLASSIFY_EVENT },
    onFailure: async ({ event, step, logger }) => {
      const eventData = (event.data as any)?.event
        ?.data as InternalMergeAndClassifyEventData | undefined;
      const documentId = eventData?.documentId;

      if (documentId) {
        logger.error(
          { documentId },
          "Internal merge and classify workflow failed permanently.",
        );
      }
    },
  },

  async ({ step, logger, event }) => {
    const eventData = event.data as InternalMergeAndClassifyEventData;
    const { documentId, userId, cleanExisting = true } = eventData;

    logger.info(
      { documentId, userId, cleanExisting },
      "Starting internal post-OCR merge and classification pipeline.",
    );

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
      throw new Error(`No files found for document ID: ${documentId}`);
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
    }> = [];

    const fileIds: string[] = [];

    docData.files.forEach((file) => {
      fileIds.push(file.fileId);
      file.pages.forEach((page) => {
        allDocPages.push({
          fileId: file.fileId,
          fileName: file.fileName,
          pageId: page.id,
          pageNo: page.pageNo,
          ocrStatus: page.ocrStatus,
          ocrText: page.ocrText,
          survivedValidation: page.survivedValidation,
          isRelevant: page.isRelevant,
        });
      });
    });

    if (allDocPages.length === 0) {
      throw new Error(`Document ID ${documentId} contains no pages.`);
    }

    // 2. Validate OCR readiness: all pages must have completed OCR
    await step.run("validate-ocr-readiness", async () => {
      const incompletePages = allDocPages.filter(
        (p) =>
          p.ocrStatus !== "completed" ||
          !p.ocrText ||
          p.ocrText.trim().length === 0,
      );

      if (incompletePages.length > 0) {
        throw new Error(
          `Cannot merge: ${incompletePages.length} out of ${allDocPages.length} pages do not have completed OCR text. Incomplete page numbers: ${incompletePages.map((p) => p.pageNo).join(", ")}`,
        );
      }
    });

    // 3. Optional: Clean up existing questions for idempotent re-runs
    if (cleanExisting && fileIds.length > 0) {
      await step.run("cleanup-existing-questions", async () => {
        const deletedCount = await questionsRepository.deleteByFileIds(
          db,
          fileIds,
        );
        logger.info(
          { documentId, deletedCount },
          "Cleaned up existing questions prior to re-merge.",
        );
        return { deletedCount };
      });
    }

    // 4. Update status to merging_questions
    await step.run("mark-document-merging-questions", async () => {
      await documentsRepository.updateProcessingStatus(
        db,
        documentId,
        "merging_questions",
      );
    });

    // 5. Assemble OCR results across ALL pages of the document
    const allOcrResults: OcrPageResult[] = allDocPages.map((page) => ({
      pageNo: page.pageNo,
      pageId: page.pageId,
      fileId: page.fileId,
      rawText: page.ocrText,
      status: "completed",
      survivedValidation: page.survivedValidation,
      isRelevant: page.isRelevant,
    }));

    // 6. Merge questions and resolve passages using order-based system
    const resolvedQuestions: ResolvedQuestion[] = await step.run(
      "merge-ocr-questions",
      async () => {
        return mergeOcrResults(allOcrResults);
      },
    );

    logger.info(
      {
        documentId,
        totalPages: allDocPages.length,
        totalResolvedQuestions: resolvedQuestions.length,
      },
      "Questions successfully merged with order-based passage assignment.",
    );

    if (resolvedQuestions.length === 0) {
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
        totalQuestionsClassified: 0,
        message: "No questions resolved from OCR pages.",
      };
    }

    // 7. Resolve default chapters and persist comprehension passages
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
          const passageId = await questionsRepository.findOrCreatePassage(
            db,
            passageContent,
          );
          passageMap[passageContent] = passageId;
        }

        return { chapterMap, passageMap };
      },
    );

    // 8. Prepare payload and persist all questions to the database
    const saveResult = await step.run("save-questions", async () => {
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

    // 9. Classify questions and assign curriculum chapter IDs
    const classifiedCount = await step.run(
      "classify-and-assign-chapters",
      async () => {
        if (
          !saveResult.insertedQuestions ||
          saveResult.insertedQuestions.length === 0
        ) {
          return 0;
        }

        logger.info(
          { documentId, count: saveResult.insertedQuestions.length },
          "Starting 2-step hierarchical curriculum classification with Groq LLM.",
        );

        try {
          const classifications =
            await curriculumClassifierService.classifyQuestions(
              db,
              saveResult.insertedQuestions,
            );

          const updates = classifications.map((c) => ({
            id: c.id,
            chapterId: c.chapterId,
          }));

          await questionsRepository.updateManyChapterIds(db, updates);

          logger.info(
            { documentId, classifiedCount: updates.length },
            "Curriculum classification and chapter ID updates completed.",
          );

          return updates.length;
        } catch (err) {
          logger.error(
            { documentId, error: err },
            "Curriculum classification encountered an error; questions remain with subject fallback chapters.",
          );
          return 0;
        }
      },
    );

    // 10. Mark document as successfully completed
    await step.run("mark-document-completed", async () => {
      await documentsRepository.updateProcessingStatus(
        db,
        documentId,
        "completed",
      );
    });

    logger.info(
      {
        documentId,
        totalQuestionsSaved: saveResult.savedCount,
        totalQuestionsClassified: classifiedCount,
      },
      "Internal post-OCR pipeline finished successfully.",
    );

    return {
      success: true,
      documentId,
      totalPages: allDocPages.length,
      totalQuestionsSaved: saveResult.savedCount,
      totalQuestionsClassified: classifiedCount,
    };
  },
);

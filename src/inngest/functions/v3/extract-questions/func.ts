import { db } from "@/db";
import { inngest } from "../../../client";
import { documentQueries } from "@/features/documents/repositories/document-queries";
import { PDFStoragePathsRetriever } from "@/lib/supabase/storage-paths";
import { DocumentWithPagesDTO } from "@/features/documents/dto/projections";
import { JsonifyObject } from "inngest/types";

import { documentRepository } from "@/features/documents/repositories/documents.repository";
import {
  questionsRepository,
  type CreateQuestionItem,
} from "@/features/questions/repositories/questions.repository";
import { generateUUIDv7 } from "@/features/shared/utils";
import { mergeOcrResults } from "./merge-ocr-results";
import type { ResolvedQuestion } from "./types";
import {
  QuestionPersistError,
  QuestionMergeError,
} from "./errors";
import { ocrPage, OcrPageResult, OcrPageFailedError } from "../ocr-page";
import type { ExtractedFigure } from "../ocr-page/types";
import { EMPTY_PAGE_STATE } from "../ocr-page/super-schema";
import {
  GeminiLLMService,
  GeminiModels,
} from "@/services/llm/gemini.service";
import { env } from "@/config/env/server";
import { mapExtractedFiguresToQuestions } from "./figures";
import { resolveUnresolvedEntities } from "./resolver";
import {
  applyStandaloneRewrites,
  rewriteStandaloneEntities,
} from "./standalone";
import { createOcrLogger } from "@/lib/logger";

export interface ExtractDocumentQuestionEventData {
  userId: string;
  documentId: string;
}

export const EXTRACT_QUESTIONS_EVENT = "v3/documents/extract" as const;

export const extractQuestions = inngest.createFunction(
  {
    id: "extract-questions-from-document-v3",
    triggers: { event: EXTRACT_QUESTIONS_EVENT },
    onFailure: async ({ event, step, logger }) => {
      const eventData = (event.data as any)?.event?.data as
        | ExtractDocumentQuestionEventData
        | undefined;
      const documentId = eventData?.documentId;

      if (documentId && eventData?.userId) {
        logger.error(
          { documentId },
          "Extract questions workflow failed permanently. Marking document as failed.",
        );
        await step.run("mark-document-failed-on-error", async () => {
          await documentRepository.commands.update(db, {
            documentId,
            userId: eventData.userId,
            status: "failed",
          });
        });
      }
    },
  },

  async ({ step, logger, event }) => {
    const eventData = event.data as ExtractDocumentQuestionEventData;
    const { documentId, userId } = eventData;

    // Structured document-scoped logger. Every log line carries
    // document/user context so extraction errors are traceable.
    const log = createOcrLogger({
      documentId,
      userId,
      fnVersion: 3,
      stage: "extract-questions",
    });

    log.info("Extract questions started");

    // 1. Fetch document files and pages metadata from the database
    const docData: JsonifyObject<DocumentWithPagesDTO> | null = await step.run(
      "fetch-document-pages",
      async () => {
        return await documentQueries.getDocumentWithPages(
          db,
          userId,
          documentId,
        );
      },
    );

    if (!docData || !docData.files || docData.files.length === 0) {
      await step.run("mark-document-failed-no-files", async () => {
        await documentRepository.commands.update(db, {
          documentId,
          userId,
          status: "failed",
        });
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
        const pageStoragePath =
          PDFStoragePathsRetriever.getDocumentFilePageSourceUrl(
            userId,
            documentId,
            file.fileId,
            "webp",
            page.pageNo,
          );
        allDocPages.push({
          fileId: file.fileId,
          fileName: file.filename,
          pageId: page.id,
          pageNo: page.pageNo,
          ocrStatus: page.ocrStatus,
          ocrText: page.ocrText,
          survivedValidation: page.survivedValidation ?? false,
          isRelevant: page.isRelevant ?? true,
          storagePath: pageStoragePath,
        });
      });
    });

    if (allDocPages.length === 0) {
      await step.run("mark-document-failed-no-pages", async () => {
        await documentRepository.commands.update(db, {
          documentId,
          userId,
          status: "failed",
        });
      });

      return {
        success: false,
        message: "No pages found for document.",
        documentId,
        results: [],
      };
    }

    // 2. Step-Level Retry Detection & Page Filtering
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
        await documentRepository.commands.update(db, {
          documentId,
          userId,
          status: "extracting_questions",
        });
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
    // NOTE: previously-completed pages persisted via the v3 page schema carry
    // their structured parse in ocrText JSON — but stitching requires
    // parsedData, which older completed pages may not have. When ANY page
    // lacks parsedData we must re-run its OCR to obtain path-identity data.
    const allOcrResults: OcrPageResult[] = allDocPages.map((page) => {
      const newlyProcessed = newResultsMap.get(page.pageId);
      if (newlyProcessed) return newlyProcessed;

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
        startState: EMPTY_PAGE_STATE,
        endState: EMPTY_PAGE_STATE,
      };
    });

    const pagesMissingParsedData = allOcrResults.filter(
      (r) => r.status === "completed" && r.isRelevant && !r.parsedData,
    );

    if (pagesMissingParsedData.length > 0) {
      logger.info(
        {
          documentId,
          count: pagesMissingParsedData.length,
        },
        "Completed pages lack v3 structured parse data; re-invoking OCR for path-identity extraction.",
      );

      const recovered = await Promise.all(
        pagesMissingParsedData.map((item) =>
          step.invoke(`ocr-page-${item.pageId}`, {
            function: ocrPage,
            data: {
              userId,
              documentId,
              fileId: item.fileId,
              fileName:
                allDocPages.find((p) => p.pageId === item.pageId)?.fileName ??
                "unknown",
              pageId: item.pageId,
              pageNo: item.pageNo,
              storagePath: allDocPages.find((p) => p.pageId === item.pageId)
                ?.storagePath,
            },
          }),
        ),
      );

      recovered.forEach((res, index) => {
        const target = allOcrResults.find(
          (r) => r.pageId === pagesMissingParsedData[index].pageId,
        );
        if (target) {
          Object.assign(target, res);
        }
      });
    }

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
        await documentRepository.commands.update(db, {
          documentId,
          userId,
          status: "failed",
        });
      });

      throw new OcrPageFailedError(
        failedPages[0].pageId,
        failedPages[0].pageNo,
        `${failedPages.length} out of ${allDocPages.length} pages failed OCR. Merging aborted.`,
      );
    }

    // 5. All pages are successful! Ensure status is merging_questions and merge
    await step.run("mark-document-merging-questions", async () => {
      await documentRepository.commands.update(db, {
        documentId,
        userId,
        status: "merging_questions",
      });
    });

    // Phase 2 prep — collect the figures extracted by the ocr-page stage.
    // They are passed INTO the merge so pathless boundary-fragment crops
    // (keyed under the synthetic "@start"/"@end" slots) can be re-bound to
    // the real paths of the items their fragments were merged into.
    const allExtractedFigures: ExtractedFigure[] = [];
    for (const result of allOcrResults) {
      if (result.extractedFigures) {
        allExtractedFigures.push(...result.extractedFigures);
      }
    }

    const stitchResult = await step.run("merge-ocr-questions", async () => {
      try {
        const result = mergeOcrResults(allOcrResults, allExtractedFigures);
        if (result.warnings.length > 0) {
          log.warn("Stitching produced warnings during merge.", {
            warnings: result.warnings,
          });
        }
        if (result.unresolved.length > 0) {
          log.info("Stitching left unresolved entities for the LLM resolver.", {
            unresolved: result.unresolved.length,
          });
        }
        return result;
      } catch (error) {
        log.error("Merge-ocr-questions step failed", {}, error);
        throw error;
      }
    });

    let resolvedQuestions: ResolvedQuestion[] = stitchResult.questions;

    // -----------------------------------------------------------------------
    // RESOLVER PASS — send unresolved/incomplete/not-ready entities to an LLM
    // call with neighboring context, and keep whatever it salvages so it is
    // inserted into the database alongside the resolved questions.
    // -----------------------------------------------------------------------
    if (stitchResult.unresolved.length > 0) {
      try {
        const llmService = new GeminiLLMService(
          env.GEMINI_API_KEY,
          GeminiModels.GEMINI_3_5_FLASH_LITE,
        );

        const pageRawTexts = new Map<number, string | null>();
        for (const page of allOcrResults) {
          pageRawTexts.set(page.pageNo, page.rawText);
        }

        // Neighboring resolved questions in read order for each unresolved id.
        const neighbors = new Map<
          string,
          {
            previousLabel?: string;
            previousText?: string;
            nextLabel?: string;
            nextText?: string;
          }
        >();
        const unresolvedPageIds = new Set(
          stitchResult.unresolved.map((entry) => entry.id),
        );
        void unresolvedPageIds;
        for (const entry of stitchResult.unresolved) {
          const before = resolvedQuestions.filter(
            (q) =>
              q.fileId === entry.fileId && Math.min(...q.pageNos) <= entry.pageNo,
          );
          const previous = before[before.length - 1];
          const after = resolvedQuestions.filter(
            (q) =>
              q.fileId === entry.fileId && Math.min(...q.pageNos) >= entry.pageNo,
          );
          const next = after[0];
          neighbors.set(entry.id, {
            previousLabel: previous?.label,
            previousText: previous?.question,
            nextLabel: next?.label,
            nextText: next?.question,
          });
        }

        const outcome = await step.run("resolve-unresolved-entities", async () => {
          return await resolveUnresolvedEntities(
            llmService,
            stitchResult.unresolved,
            { pageRawTexts, neighbors },
          );
        });

        log.info("LLM resolution pass over unresolved entities complete.", {
          documentId,
          unresolved: stitchResult.unresolved.length,
          resolved: outcome.resolved.length,
          discarded: outcome.discarded.length,
          failed: outcome.failed.length,
        });

        resolvedQuestions = [...resolvedQuestions, ...outcome.resolved];
      } catch (error) {
        // Resolver failure must not kill the whole extraction: log and
        // continue with the successfully stitched questions.
        log.error("LLM resolution pass failed; continuing with stitched questions only.", {
          documentId,
          error: error instanceof Error ? error.message : String(error),
        }, error);
      }
    }

    // -----------------------------------------------------------------------
    // STANDALONE REWRITE PASS — non-standalone (fragment) questions get an
    // LLM pass that combines their own text with the parent stem and
    // sibling context into complete, self-contained question + solution
    // text. Figure markers ([[FIG:<path>]]) are preserved verbatim. The
    // stitcher's deterministic stem-joined text remains the fallback.
    // -----------------------------------------------------------------------
    if (stitchResult.standaloneRewrites.length > 0) {
      try {
        const rewriteService = new GeminiLLMService(
          env.GEMINI_API_KEY,
          GeminiModels.GEMINI_3_5_FLASH_LITE,
        );

        const outcome = await step.run("rewrite-standalone-questions", async () => {
          return await rewriteStandaloneEntities(
            rewriteService,
            stitchResult.standaloneRewrites,
          );
        });

        applyStandaloneRewrites(
          resolvedQuestions,
          stitchResult.standaloneRewrites,
          outcome,
        );

        log.info("Standalone rewrite pass complete.", {
          documentId,
          fragments: stitchResult.standaloneRewrites.length,
          rewritten: outcome.rewrites.length,
          keptFallback: outcome.skipped.length,
        });
      } catch (error) {
        // Rewrite failure must not kill the extraction: fragments keep
        // their deterministic stem-joined text.
        log.error("Standalone rewrite pass failed; keeping stitched text.", {
          documentId,
          fragments: stitchResult.standaloneRewrites.length,
          error: error instanceof Error ? error.message : String(error),
        }, error);
      }
    }

    log.info("All pages merged and questions resolved successfully.", {
      documentId,
      totalDocPages: allDocPages.length,
      totalResolvedQuestions: resolvedQuestions.length,
    });

    // Phase 2 — Map figures extracted by the ocr-page stage onto resolved
    // questions via the canonical path key (pathless fragment crops were
    // already re-bound during the merge).
    const figurePaths = mapExtractedFiguresToQuestions(
      resolvedQuestions,
      allExtractedFigures,
    );

    if (allExtractedFigures.length > 0) {
      logger.info(
        {
          documentId,
          totalFigures: allExtractedFigures.length,
          questionsWithFigures: figurePaths.size,
        },
        "Figure paths mapped to resolved questions.",
      );
    } else {
      logger.info(
        { documentId },
        "No figures extracted from any page; skipping figure mapping.",
      );
    }

    if (resolvedQuestions.length === 0) {
      logger.warn(
        { documentId },
        "No valid questions could be resolved from OCR output.",
      );

      await step.run("mark-document-completed-zero-questions", async () => {
        await documentRepository.commands.update(db, {
          documentId,
          userId,
          status: "completed",
        });
      });

      return {
        success: true,
        documentId,
        totalPages: allDocPages.length,
        totalQuestionsSaved: 0,
        message: "No questions found in document.",
      };
    }

    const normalizePassage = (content: string) => content.trim();

    const distinctPassages = Array.from(
      new Set(
        resolvedQuestions
          .map((q) => q.passageContent)
          .filter((p): p is string => Boolean(p?.trim()))
          .map(normalizePassage),
      ),
    );

    const passageMap: Record<string, string> =
      distinctPassages.length > 0
        ? await step.run("create-passages", async () => {
            const results = await questionsRepository.createManyPassages(
              db,
              distinctPassages,
            );

            return Object.fromEntries(
              results.map((result) => [
                normalizePassage(result.content),
                result.id,
              ]),
            );
          })
        : {};

    const saveResult = await step.run("save-questions", async () => {
      try {
        const payload: CreateQuestionItem[] = [];

        for (const q of resolvedQuestions) {
          const questionId = generateUUIDv7();
          const passageContent = q.passageContent?.trim() || null;

          const passageId = passageContent
            ? (passageMap[passageContent] ?? null)
            : null;

          // Figure storage paths mapped during the figure phase
          const diagrams =
            !q.pathKey.startsWith("resolved:")
              ? figurePaths.get(q.pathKey)
              : undefined;

          if (q.needsReview) {
            logger.info(
              {
                documentId,
                label: q.label,
                reasons: q.reviewReasons,
              },
              "Inserting a needs-review question (resolver-recovered or ambiguous stitching).",
            );
          }

          payload.push({
            id: questionId,
            chapterId: null,
            passageId,

            fileId: q.fileId,
            question: q.question,
            options: q.options,
            correctOption: q.correctOption,
            marks: q.marks,

            questionDiagram: diagrams?.questionDiagram ?? null,
            hint: q.hint ?? null,
            solution: q.solution ?? null,
            solutionDiagram: diagrams?.solutionDiagram ?? null,
            figureResolved: q.figureResolved ?? true,
            failureReasons: q.failureReasons ?? [],
            isReady: q.isReady ?? false,
          });
        }

        const inserted = await questionsRepository.createMany(db, payload);

        return {
          savedCount: inserted.length,
          insertedQuestions: inserted.map((q, idx) => ({
            id: q.id,
            question: q.question,
            options: q.options as Array<{
              key: string;
              text: string;
            }>,
            subject: resolvedQuestions[idx]?.subject || null,
            passageContent: resolvedQuestions[idx]?.passageContent || null,
          })),
        };
      } catch (err) {
        log.error("Failed to save resolved questions to database.", {
          documentId,
          error: err instanceof Error ? err.message : String(err),
        }, err);

        throw new QuestionPersistError(
          `Failed to persist questions to database: ${
            err instanceof Error ? err.message : String(err)
          }`,
          err,
        );
      }
    });

    await step.run("mark-document-completed", async () => {
      await documentRepository.commands.update(db, {
        documentId,
        userId,
        status: "completed",
      });
    });

    return {
      success: true,
      documentId,
      totalPages: allDocPages.length,
      totalQuestionsSaved: saveResult.savedCount,
      message: `${saveResult.savedCount} questions saved successfully.`,
    };
  },
);

// Keep the merge error type exported for callers that wrap merging steps.
export { QuestionMergeError };

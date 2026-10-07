import { db } from "@/db";
import { documentFiles, filePages, questions } from "@/db/schemas";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { OcrPageResult } from "../ocr-page/types";
import { mergeOcrResults } from "../extract-questions/merge-ocr-results";
import {
  toClassifiableQuestion,
  type ClassifiableQuestion,
} from "./classifiable-question-schema";

/**
 * A question that is still waiting for a `chapter_id`, paired with the row it
 * will be written back to.
 */
export interface PendingClassifiableQuestion extends ClassifiableQuestion {
  /** `questions.id` row whose `chapter_id` is currently null. */
  questionId: string;
  fileId: string;
}

/**
 * Builds the `OcrPageResult[]` the extraction pipeline feeds to
 * `mergeOcrResults`, so classification reuses the exact same parse — including
 * cross-page merges, passage tracking and answer-key handling.
 */
function toOcrPageResults(
  rows: Array<{
    pageId: string;
    fileId: string;
    pageNo: number;
    ocrStatus: string;
    ocrText: string | null;
    survivedValidation: boolean;
    isRelevant: boolean;
  }>,
): OcrPageResult[] {
  return rows.map((row) => ({
    pageNo: row.pageNo,
    pageId: row.pageId,
    fileId: row.fileId,
    rawText: row.ocrText,
    status:
      row.ocrStatus === "completed" && row.ocrText?.trim()
        ? "completed"
        : "failed",
    survivedValidation: row.survivedValidation,
    isRelevant: row.isRelevant,
  }));
}

/**
 * Loads the classification input for a document straight from the stored OCR
 * raw text — not from the `questions` table — because the subject tag lives in
 * the OCR output and is discarded at insert time.
 *
 * Returns only questions that are still unclassified, so re-running the
 * function picks up exactly the rows that were skipped or failed before.
 *
 * Matching is content-based (`fileId` + question text) rather than positional:
 * rows that were already classified must not shift the mapping for the ones
 * that were not.
 */
export async function loadUnclassifiedClassifiableQuestions(
  documentId: string,
): Promise<PendingClassifiableQuestion[]> {
  const pageRows = await db
    .select({
      pageId: filePages.id,
      fileId: filePages.fileId,
      pageNo: filePages.pageNo,
      ocrStatus: filePages.ocrStatus,
      ocrText: filePages.ocrText,
      survivedValidation: filePages.survivedValidation,
      isRelevant: filePages.isRelevant,
    })
    .from(filePages)
    .innerJoin(documentFiles, eq(filePages.fileId, documentFiles.id))
    .where(eq(documentFiles.documentId, documentId))
    .orderBy(asc(documentFiles.id), asc(filePages.pageNo));

  if (pageRows.length === 0) {
    return [];
  }

  const resolved = mergeOcrResults(toOcrPageResults(pageRows));
  if (resolved.length === 0) {
    return [];
  }

  const fileIds = [...new Set(resolved.map((question) => question.fileId))];

  const unclassifiedRows = await db
    .select({
      id: questions.id,
      fileId: questions.fileId,
      question: questions.question,
    })
    .from(questions)
    .where(
      and(
        inArray(questions.fileId, fileIds),
        isNull(questions.chapterId),
      ),
    );

  const rowIdQueueByQuestion = new Map<string, string[]>();
  for (const row of unclassifiedRows) {
    const key = `${row.fileId}\u0000${row.question}`;
    const queue = rowIdQueueByQuestion.get(key);
    if (queue) {
      queue.push(row.id);
    } else {
      rowIdQueueByQuestion.set(key, [row.id]);
    }
  }

  const pending: PendingClassifiableQuestion[] = [];

  for (const question of resolved) {
    const classifiable = toClassifiableQuestion(question);
    if (!classifiable) continue;

    const queue = rowIdQueueByQuestion.get(
      `${question.fileId}\u0000${question.question}`,
    );
    const questionId = queue?.shift();
    if (!questionId) continue;

    pending.push({
      ...classifiable,
      questionId,
      fileId: question.fileId,
    });
  }

  return pending;
}

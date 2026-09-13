"use server";

import { questionsService } from "../service";
import { ServerActionResult } from "@/features/shared/actions/types";
import { handleActionError } from "@/features/shared/actions/error";

export type QuestionItemDTO = Awaited<
  ReturnType<typeof questionsService.getRecentQuestions>
>[number];

export interface GetRecentQuestionsActionResponse {
  questions: QuestionItemDTO[];
  documentId?: string | null;
  documentTitle?: string | null;
}

export interface DocumentFilterOptionDTO {
  id: string;
  title: string;
  questionCount: number;
  createdAt: string | null;
}

export interface GetRecentDocumentsActionResponse {
  documents: DocumentFilterOptionDTO[];
}

export async function getRecentQuestionsAction(
  limitOrParams: number | { limit?: number; documentId?: string } = 50,
  legacyDocId?: string,
): Promise<ServerActionResult<GetRecentQuestionsActionResponse>> {
  try {
    let limit = 50;
    let documentId: string | undefined = undefined;

    if (typeof limitOrParams === "number") {
      limit = limitOrParams;
      documentId = legacyDocId?.trim() || undefined;
    } else if (limitOrParams && typeof limitOrParams === "object") {
      limit = limitOrParams.limit ?? 50;
      documentId = limitOrParams.documentId?.trim() || undefined;
    }

    const questions = await questionsService.getRecentQuestions(limit, documentId);
    const documentTitle = questions.length > 0 ? questions[0].documentTitle : null;

    return {
      success: true,
      data: {
        questions,
        documentId: documentId || null,
        documentTitle,
      },
      message: `Fetched ${questions.length} questions successfully.`,
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function getRecentDocumentsForFilterAction(): Promise<
  ServerActionResult<GetRecentDocumentsActionResponse>
> {
  try {
    const documents = await questionsService.getRecentDocumentsForFilter(30);

    return {
      success: true,
      data: {
        documents,
      },
      message: `Fetched ${documents.length} documents successfully.`,
    };
  } catch (error) {
    return handleActionError(error);
  }
}

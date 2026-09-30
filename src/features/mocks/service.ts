import { db } from "@/db";
import { ServerActionError } from "@/features/shared/actions/error";
import { generateUUIDv7 } from "@/features/shared/utils";
import {
  CreateMockTestCommand,
  CreateMockTestQuestionItemCommand,
} from "./dto/commands";
import { CreateMockTestFromDocumentsPayload } from "./dto/payloads";
import {
  DocumentOptionForMockProjection,
  MockTestDetailsProjection,
  MockTestListItemProjection,
} from "./dto/projections";
import {
  CreateMockTestResult,
  DeleteMockTestResult,
} from "./dto/results";
import { mockTestsRepository } from "./repositories/mock-tests.repository";

export class MockTestsService {
  /**
   * Retrieves all documents with their question counts so admin can pick documents to assemble a test.
   */
  async getDocumentsForMockCreation(): Promise<DocumentOptionForMockProjection[]> {
    return await mockTestsRepository.findDocumentsWithQuestionsCount(db);
  }

  /**
   * Creates a new mock test directly from selected documents.
   * Pulls all questions associated with the chosen documents and links them in sequence.
   */
  async createFromDocuments(
    userId: string,
    payload: CreateMockTestFromDocumentsPayload,
  ): Promise<CreateMockTestResult> {
    const trimmedName = payload.name?.trim();
    if (!trimmedName) {
      throw new ServerActionError(
        "INVALID_ARGUMENT",
        "Mock test name is required.",
      );
    }

    if (!payload.documentIds || payload.documentIds.length === 0) {
      throw new ServerActionError(
        "INVALID_ARGUMENT",
        "Please select at least one document to generate the mock test from.",
      );
    }

    const durationMinutes = payload.durationMinutes > 0 ? payload.durationMinutes : 60;
    const durationSeconds = durationMinutes * 60;
    const negativePercent = Math.max(
      0,
      Math.min(100, Math.round(payload.negativePercentagePerQuestion || 0)),
    );

    // Fetch all questions originating from the selected documents
    const matchedQuestions = await mockTestsRepository.findQuestionsByDocumentIds(
      db,
      payload.documentIds,
    );

    if (matchedQuestions.length === 0) {
      throw new ServerActionError(
        "INVALID_ARGUMENT",
        "No questions found in the selected document(s). Please make sure the documents have extracted questions.",
      );
    }

    const totalMarks =
      payload.customTotalMarks && payload.customTotalMarks > 0
        ? payload.customTotalMarks
        : matchedQuestions.reduce((acc, q) => acc + (q.marks || 1), 0);

    const mockTestId = generateUUIDv7();

    const mockTestCommand: CreateMockTestCommand = {
      id: mockTestId,
      userId,
      name: trimmedName,
      totalMarks,
      negativePercentagePerQuestion: negativePercent,
      durationSeconds,
      instructions: payload.instructions?.trim() || null,
    };

    const questionItemsCommand: CreateMockTestQuestionItemCommand[] =
      matchedQuestions.map((q, idx) => ({
        id: generateUUIDv7(),
        mockTestId,
        questionId: q.id,
        position: idx + 1,
      }));

    // Atomically persist the test and all question assignments
    await db.transaction(async (tx) => {
      await mockTestsRepository.create(tx, mockTestCommand);
      await mockTestsRepository.createMockTestQuestions(tx, questionItemsCommand);
    });

    return {
      id: mockTestId,
      name: trimmedName,
      totalMarks,
      totalQuestions: matchedQuestions.length,
      durationSeconds,
      negativePercentagePerQuestion: negativePercent,
    };
  }

  /**
   * Retrieves all mock tests with stats for admin view.
   */
  async getAllMockTests(options?: {
    search?: string;
  }): Promise<MockTestListItemProjection[]> {
    return await mockTestsRepository.findAll(db, options);
  }

  /**
   * Retrieves single mock test details with ordered questions.
   */
  async getMockTestById(id: string): Promise<MockTestDetailsProjection> {
    const test = await mockTestsRepository.findById(db, id);
    if (!test) {
      throw new ServerActionError(
        "NOT_FOUND",
        `Mock test with ID ${id} was not found.`,
      );
    }
    return test;
  }

  /**
   * Deletes a mock test and all its question associations.
   */
  async deleteMockTest(id: string): Promise<DeleteMockTestResult> {
    const existing = await mockTestsRepository.findById(db, id);
    if (!existing) {
      throw new ServerActionError(
        "NOT_FOUND",
        `Mock test with ID ${id} was not found.`,
      );
    }

    await mockTestsRepository.delete(db, id);
    return {
      deletedId: id,
      success: true,
    };
  }
}

export const mockTestsService = new MockTestsService();

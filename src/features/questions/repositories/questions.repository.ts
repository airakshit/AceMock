import {
  chapters,
  documentFiles,
  documents,
  passages,
  questions,
  sections,
  subjects,
} from "@/db/schemas";
import { asc, count, desc, eq, inArray } from "drizzle-orm";
import { DbExecutor } from "../../shared/types";
import { generateUUIDv7 } from "../../shared/utils";
import {
  CreateQuestionItemCommand,
} from "../dto/commands";
import {
  ChapterCurriculumMappingProjection,
  DocumentWithQuestionCountProjection,
  PassageProjection,
  QuestionDetailsProjection
} from "../dto/projections";

// Backward-compatible alias for existing consumers (e.g. inngest)
export type CreateQuestionItem = CreateQuestionItemCommand;


export class QuestionsRepository {
  async findChapterBySlug(db: DbExecutor, slug: string) {
    const [chapter] = await db
      .select()
      .from(chapters)
      .where(eq(chapters.slug, slug))
      .limit(1);

    return chapter || null;
  }

  async create(
    db: DbExecutor,
    data: CreateQuestionItemCommand,
  ): Promise<typeof questions.$inferSelect> {
    const [question] = await db
      .insert(questions)
      .values({
        id: data.id,
        chapterId: data.chapterId,
        question: data.question,
        options: data.options,
        correctOption: data.correctOption,
        marks: data.marks,
        difficulty: data.difficulty,
        passageId: data.passageId ?? null,
        fileId: data.fileId ?? null,
        questionDiagram: data.questionDiagram ?? null,
        hint: data.hint ?? null,
        solution: data.solution ?? null,
        solutionDiagram: data.solutionDiagram ?? null,
      })
      .returning();

    return question;
  }

  async createMany(
    db: DbExecutor,
    items: CreateQuestionItemCommand[],
  ): Promise<(typeof questions.$inferSelect)[]> {
    if (items.length === 0) {
      return [];
    }

    const valuesToInsert = items.map((item) => ({
      id: item.id,
      chapterId: item.chapterId,
      question: item.question,
      options: item.options,
      correctOption: item.correctOption,
      marks: item.marks,
      difficulty: item.difficulty,
      passageId: item.passageId ?? null,
      fileId: item.fileId ?? null,
      questionDiagram: item.questionDiagram ?? null,
      hint: item.hint ?? null,
      solution: item.solution ?? null,
      solutionDiagram: item.solutionDiagram ?? null,
    }));

    return db.insert(questions).values(valuesToInsert).returning();
  }

  async deleteByFileIds(db: DbExecutor, fileIds: string[]): Promise<number> {
    if (fileIds.length === 0) {
      return 0;
    }
    const deleted = await db
      .delete(questions)
      .where(inArray(questions.fileId, fileIds))
      .returning({ id: questions.id });

    return deleted.length;
  }

  async createPassage(db: DbExecutor, content: string): Promise<string> {
    const [passage] = await db
      .insert(passages)
      .values({
        id: generateUUIDv7(),
        content,
      })
      .returning();

    return passage.id;
  }

  async createManyPassages(
    db: DbExecutor,
    passageContents: string[],
  ): Promise<PassageProjection[]> {
    const toInsert = passageContents.map((value) => {
      return {
        id: generateUUIDv7(),
        content: value,
      };
    });
    const insertedPassages = await db
      .insert(passages)
      .values(toInsert)
      .returning();
    return insertedPassages;
  }

  async findById(
    db: DbExecutor,
    id: string,
  ): Promise<typeof questions.$inferSelect | null> {
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, id))
      .limit(1);

    return question || null;
  }

  async findByFileId(
    db: DbExecutor,
    fileId: string,
  ): Promise<(typeof questions.$inferSelect)[]> {
    return db
      .select()
      .from(questions)
      .where(eq(questions.fileId, fileId))
      .orderBy(desc(questions.createdAt));
  }

  async findRecent(
    db: DbExecutor,
    limit: number = 20,
  ): Promise<(typeof questions.$inferSelect)[]> {
    return db
      .select()
      .from(questions)
      .orderBy(desc(questions.createdAt))
      .limit(limit);
  }

  async findRecentWithCurriculum(
    db: DbExecutor,
    limit: number = 50,
    documentId?: string,
  ): Promise<QuestionDetailsProjection[]> {
    const baseQuery = db
      .select({
        id: questions.id,
        question: questions.question,
        options: questions.options,
        correctOption: questions.correctOption,
        marks: questions.marks,
        difficulty: questions.difficulty,
        questionDiagram: questions.questionDiagram,
        hint: questions.hint,
        solution: questions.solution,
        solutionDiagram: questions.solutionDiagram,
        createdAt: questions.createdAt,
        updatedAt: questions.updatedAt,
        chapterId: chapters.id,
        chapterName: chapters.name,
        chapterSlug: chapters.slug,
        sectionName: sections.name,
        subjectName: subjects.name,
        subjectSlug: subjects.slug,
        fileId: questions.fileId,
        fileName: documentFiles.filename,
        documentId: documentFiles.documentId,
        documentTitle: documents.title,
      })
      .from(questions)
      .leftJoin(documentFiles, eq(questions.fileId, documentFiles.id))
      .leftJoin(documents, eq(documentFiles.documentId, documents.id))
      .leftJoin(chapters, eq(questions.chapterId, chapters.id))
      .leftJoin(sections, eq(chapters.sectionId, sections.id))
      .leftJoin(subjects, eq(sections.subjectId, subjects.id));

    if (documentId) {
      return baseQuery
        .where(eq(documentFiles.documentId, documentId))
        .orderBy(asc(questions.createdAt))
        .limit(limit);
    }

    return baseQuery.orderBy(desc(questions.createdAt)).limit(limit);
  }

  async findRecentDocumentsWithQuestions(
    db: DbExecutor,
    limit: number = 20,
  ): Promise<DocumentWithQuestionCountProjection[]> {
    const records = await db
      .select({
        id: documents.id,
        title: documents.title,
        createdAt: documents.createdAt,
        questionCount: count(questions.id),
      })
      .from(documents)
      .leftJoin(documentFiles, eq(documentFiles.documentId, documents.id))
      .leftJoin(questions, eq(questions.fileId, documentFiles.id))
      .groupBy(documents.id, documents.title, documents.createdAt)
      .orderBy(desc(documents.createdAt))
      .limit(limit);

    return records.map((record) => ({
      id: record.id,
      title: record.title,
      createdAt: record.createdAt,
      questionCount: Number(record.questionCount || 0),
    }));
  }

  async getAllChaptersMap(
    db: DbExecutor,
  ): Promise<Map<string, ChapterCurriculumMappingProjection>> {
    const records = await db
      .select({
        id: chapters.id,
        name: chapters.name,
        slug: chapters.slug,
        sectionId: sections.id,
        sectionSlug: sections.slug,
        sectionName: sections.name,
        subjectId: subjects.id,
        subjectSlug: subjects.slug,
        subjectName: subjects.name,
      })
      .from(chapters)
      .leftJoin(sections, eq(chapters.sectionId, sections.id))
      .leftJoin(subjects, eq(sections.subjectId, subjects.id));

    const map = new Map<string, ChapterCurriculumMappingProjection>();

    for (const record of records) {
      map.set(record.slug, {
        id: record.id,
        name: record.name,
        slug: record.slug,
        sectionSlug: record.sectionSlug,
        subjectSlug: record.subjectSlug,
      });
    }

    return map;
  }

  async updateChapterId(db: DbExecutor, questionId: string, chapterId: string) {
    const [updated] = await db
      .update(questions)
      .set({ chapterId, updatedAt: new Date() })
      .where(eq(questions.id, questionId))
      .returning();

    return updated;
  }

  async updateManyChapterIds(
    db: DbExecutor,
    updates: Array<{ id: string; chapterId: string }>,
  ) {
    if (updates.length === 0) {
      return [];
    }

    return db.transaction(async (tx) => {
      const results = [];
      for (const update of updates) {
        const [updated] = await tx
          .update(questions)
          .set({ chapterId: update.chapterId, updatedAt: new Date() })
          .where(eq(questions.id, update.id))
          .returning();
        if (updated) {
          results.push(updated);
        }
      }
      return results;
    });
  }
}

export const questionsRepository = new QuestionsRepository();

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
import { QuestionDifficulty, QuestionOption } from "../types";
import { generateUUIDv7 } from "../../shared/utils";

export interface CreateQuestionItem {
  id?: string;
  chapterId: string;
  passageId?: string | null;
  fileId?: string | null;
  question: string;
  options: QuestionOption[];
  correctOption: string;
  marks?: number;
  difficulty?: QuestionDifficulty;
  diagram_url?: string | null;
  hint?: string | null;
  solution?: string | null;
  solution_diagram_url?: string | null;
}

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
    data: {
      id: string;
      chapterId: string;
      question: string;
      options: QuestionOption[];
      correctOption: string;
      marks: number;
      difficulty: QuestionDifficulty;
      diagram_url?: string | null;
      hint?: string | null;
      solution?: string | null;
      solution_diagram_url?: string | null;
    },
  ) {
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
        diagram_url: data.diagram_url ?? null,
        hint: data.hint ?? null,
        solution: data.solution ?? null,
        solution_diagram_url: data.solution_diagram_url ?? null,
      })
      .returning();

    return question;
  }

  async createMany(db: DbExecutor, items: CreateQuestionItem[]) {
    if (items.length === 0) {
      return [];
    }

    const valuesToInsert = items.map((item) => ({
      id: item.id || generateUUIDv7(),
      chapterId: item.chapterId,
      passageId: item.passageId ?? null,
      fileId: item.fileId ?? null,
      question: item.question,
      options: item.options,
      correctOption: item.correctOption,
      marks: item.marks ?? 1,
      difficulty: item.difficulty ?? ("medium" as QuestionDifficulty),
      diagram_url: item.diagram_url ?? null,
      hint: item.hint ?? null,
      solution: item.solution ?? null,
      solution_diagram_url: item.solution_diagram_url ?? null,
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

  async createPassage(
    db: DbExecutor,
    content: string,
  ): Promise<string> {
    const [passage] = await db
      .insert(passages)
      .values({
        id: generateUUIDv7(),
        content,
      })
      .returning();

    return passage.id;
  }

  async findOrCreatePassage(
    db: DbExecutor,
    content: string,
  ): Promise<string> {
    const trimmed = content.trim();
    const [existing] = await db
      .select({ id: passages.id })
      .from(passages)
      .where(eq(passages.content, trimmed))
      .limit(1);

    if (existing) {
      return existing.id;
    }

    return this.createPassage(db, trimmed);
  }

  async findOrCreateDefaultChapter(
    db: DbExecutor,
    subjectInput?: string | null,
  ): Promise<string> {
    const normalized = (subjectInput || "general").toLowerCase().trim();
    let subjectSlug = "general";
    let subjectName = "General";

    if (normalized.includes("phys")) {
      subjectSlug = "physics";
      subjectName = "Physics";
    } else if (normalized.includes("chem")) {
      subjectSlug = "chemistry";
      subjectName = "Chemistry";
    } else if (normalized.includes("math")) {
      subjectSlug = "mathematics";
      subjectName = "Mathematics";
    } else if (
      normalized.includes("eng") ||
      normalized.includes("gram") ||
      normalized.includes("comp")
    ) {
      subjectSlug = "english";
      subjectName = "English";
    } else if (normalized.length > 0) {
      subjectSlug = normalized.replace(/[^a-z0-9]+/g, "-");
      subjectName =
        normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    // 1. Ensure subject exists
    let [subject] = await db
      .select()
      .from(subjects)
      .where(eq(subjects.slug, subjectSlug))
      .limit(1);

    if (!subject) {
      const [createdSubject] = await db
        .insert(subjects)
        .values({
          id: generateUUIDv7(),
          name: subjectName,
          slug: subjectSlug,
        })
        .onConflictDoUpdate({
          target: subjects.slug,
          set: { name: subjectName },
        })
        .returning();
      subject = createdSubject;
    }

    // 2. Ensure section exists
    const sectionSlug = `${subjectSlug}-general`;
    const sectionName = `${subjectName} General`;

    let [section] = await db
      .select()
      .from(sections)
      .where(eq(sections.slug, sectionSlug))
      .limit(1);

    if (!section) {
      const [createdSection] = await db
        .insert(sections)
        .values({
          id: generateUUIDv7(),
          subjectId: subject.id,
          name: sectionName,
          slug: sectionSlug,
        })
        .onConflictDoUpdate({
          target: sections.slug,
          set: { name: sectionName },
        })
        .returning();
      section = createdSection;
    }

    // 3. Ensure default chapter exists
    const chapterSlug = `uncategorized-${subjectSlug}`;
    const chapterName = `Uncategorized ${subjectName}`;

    let [chapter] = await db
      .select()
      .from(chapters)
      .where(eq(chapters.slug, chapterSlug))
      .limit(1);

    if (!chapter) {
      const [createdChapter] = await db
        .insert(chapters)
        .values({
          id: generateUUIDv7(),
          sectionId: section.id,
          name: chapterName,
          slug: chapterSlug,
        })
        .onConflictDoUpdate({
          target: chapters.slug,
          set: { name: chapterName },
        })
        .returning();
      chapter = createdChapter;
    }

    return chapter.id;
  }

  async findById(db: DbExecutor, id: string) {
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, id))
      .limit(1);

    return question || null;
  }

  async findByFileId(db: DbExecutor, fileId: string) {
    return db
      .select()
      .from(questions)
      .where(eq(questions.fileId, fileId))
      .orderBy(desc(questions.createdAt));
  }

  async findRecent(db: DbExecutor, limit: number = 20) {
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
  ) {
    const baseQuery = db
      .select({
        id: questions.id,
        question: questions.question,
        options: questions.options,
        correctOption: questions.correctOption,
        marks: questions.marks,
        difficulty: questions.difficulty,
        diagram_url: questions.diagram_url,
        hint: questions.hint,
        solution: questions.solution,
        solution_diagram_url: questions.solution_diagram_url,
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

  async findRecentDocumentsWithQuestions(db: DbExecutor, limit: number = 20) {
    return db
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
  }

  async getAllChaptersMap(db: DbExecutor) {
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

    const map = new Map<
      string,
      {
        id: string;
        name: string;
        slug: string;
        sectionSlug: string | null;
        subjectSlug: string | null;
      }
    >();

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

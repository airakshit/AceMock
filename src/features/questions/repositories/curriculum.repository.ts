import { DbExecutor } from "@/features/shared/types";
import { subjects, sections, chapters } from "@/db/schemas";
import { eq, inArray } from "drizzle-orm";

export interface SubjectSlugLookup {
  id: string;
  slug: string;
  name: string;
}

export interface SectionLookup {
  id: string;
  subjectId: string;
  slug: string;
  name: string;
}

export interface ChapterLookup {
  id: string;
  sectionId: string;
  slug: string;
  name: string;
}

class CurriculumRespository {
  /**
   * Subject lookup used to validate a `scope = subject` creation.
   */
  async findSubjectById(
    db: DbExecutor,
    id: string,
  ): Promise<{ id: string } | null> {
    const [record] = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(eq(subjects.id, id))
      .limit(1);

    return record ?? null;
  }

  /**
   * Subject lookup by curriculum slug — the entry point for classifying a
   * question whose subject is already known from the OCR pass.
   */
  async findSubjectBySlug(
    db: DbExecutor,
    slug: string,
  ): Promise<SubjectSlugLookup | null> {
    const [record] = await db
      .select({ id: subjects.id, slug: subjects.slug, name: subjects.name })
      .from(subjects)
      .where(eq(subjects.slug, slug))
      .limit(1);

    return record ?? null;
  }

  /**
   * All sections belonging to a subject, ordered for stable prompt rendering.
   */
  async findSectionsBySubjectId(
    db: DbExecutor,
    subjectId: string,
  ): Promise<SectionLookup[]> {
    return db
      .select({
        id: sections.id,
        subjectId: sections.subjectId,
        slug: sections.slug,
        name: sections.name,
      })
      .from(sections)
      .where(eq(sections.subjectId, subjectId))
      .orderBy(sections.slug);
  }

  /**
   * Chapters across a set of sections — the leaf level that classification
   * ultimately writes onto `questions.chapter_id`.
   */
  async findChaptersBySectionIds(
    db: DbExecutor,
    sectionIds: string[],
  ): Promise<ChapterLookup[]> {
    if (sectionIds.length === 0) {
      return [];
    }

    return db
      .select({
        id: chapters.id,
        sectionId: chapters.sectionId,
        slug: chapters.slug,
        name: chapters.name,
      })
      .from(chapters)
      .where(inArray(chapters.sectionId, sectionIds))
      .orderBy(chapters.slug);
  }

  /**
   * Section lookup — also the source of the parent `subjectId` when a
   * `scope = section` test is created (parents are derived, never trusted).
   */
  async findSectionById(
    db: DbExecutor,
    id: string,
  ): Promise<{ id: string; subjectId: string } | null> {
    const [record] = await db
      .select({ id: sections.id, subjectId: sections.subjectId })
      .from(sections)
      .where(eq(sections.id, id))
      .limit(1);

    return record ?? null;
  }

  /**
   * Chapter lookup — the source of the parent `sectionId` (and, through the
   * section, the parent `subjectId`) for `scope = chapter` creations.
   */
  async findChapterById(
    db: DbExecutor,
    id: string,
  ): Promise<{ id: string; sectionId: string } | null> {
    const [record] = await db
      .select({ id: chapters.id, sectionId: chapters.sectionId })
      .from(chapters)
      .where(eq(chapters.id, id))
      .limit(1);

    return record ?? null;
  }
}

export const curriculumRepository = new CurriculumRespository();

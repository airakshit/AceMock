import { DbExecutor } from "@/features/shared/types";
import { subjects, sections, chapters } from "@/db/schemas";
import { eq } from "drizzle-orm";

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

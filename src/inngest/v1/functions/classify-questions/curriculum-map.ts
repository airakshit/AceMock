import { CURRICULUM } from "@/constants/curriculum";
import { db } from "@/db";
import { curriculumRepository } from "@/features/questions/repositories/curriculum.repository";
import type { OcrSubject } from "./classifiable-question-schema";

export type CurriculumSubjectKey = keyof typeof CURRICULUM;

/**
 * The OCR pass tags questions as `maths` / `grammar` / `comprehension`, while
 * the application curriculum stores them as `mathematics` / `english`. This
 * map is the single bridge between the two vocabularies.
 */
const SUBJECT_ALIASES: Record<OcrSubject, CurriculumSubjectKey> = {
  physics: "physics",
  chemistry: "chemistry",
  maths: "mathematics",
  grammar: "english",
  comprehension: "english",
};

/**
 * When the OCR tag is already the section, the section call is skipped and the
 * question goes straight to chapter classification. Falls back to the LLM path
 * when the pinned section is missing from the database.
 */
const SECTION_PINS: Partial<Record<OcrSubject, string>> = {
  grammar: "grammar",
  comprehension: "comprehension",
};

export function toCurriculumSubject(
  ocrSubject: OcrSubject,
): CurriculumSubjectKey | null {
  return SUBJECT_ALIASES[ocrSubject] ?? null;
}

/** Display name for a curriculum subject slug, e.g. `mathematics` → `Mathematics`. */
export function getSubjectName(subjectSlug: string): string | null {
  const subject = (
    CURRICULUM as Record<string, { name: string } | undefined>
  )[subjectSlug];
  return subject?.name ?? null;
}

export function getPinnedSectionSlug(ocrSubject: OcrSubject): string | null {
  return SECTION_PINS[ocrSubject] ?? null;
}

/**
 * The curriculum has no `description` columns — descriptions live here in
 * `curriculum.ts` so the prompt stays self-contained and versioned with the
 * curriculum itself.
 */
const SECTION_DESCRIPTIONS = new Map<string, string>();
const CHAPTER_DESCRIPTIONS = new Map<string, string>();

for (const subject of Object.values(CURRICULUM)) {
  for (const section of Object.values(subject.sections)) {
    SECTION_DESCRIPTIONS.set(section.slug, section.description);

    for (const chapter of section.chapters) {
      CHAPTER_DESCRIPTIONS.set(chapter.slug, chapter.description);
    }
  }
}

export function getSectionDescription(slug: string): string | null {
  return SECTION_DESCRIPTIONS.get(slug) ?? null;
}

export function getChapterDescription(slug: string): string | null {
  return CHAPTER_DESCRIPTIONS.get(slug) ?? null;
}

export interface CurriculumSectionOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  chapters: CurriculumChapterOption[];
}

export interface CurriculumChapterOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

/**
 * Loads the sections and chapters for a set of curriculum subject slugs,
 * attaching the code-side descriptions used to build classification prompts.
 *
 * Returned as a plain record (not a `Map`) so it can round-trip through an
 * Inngest `step.run` result.
 */
export async function loadCurriculumSections(
  subjectSlugs: string[],
): Promise<Record<string, CurriculumSectionOption[]>> {
  const result: Record<string, CurriculumSectionOption[]> = {};

  for (const slug of subjectSlugs) {
    const subject = await curriculumRepository.findSubjectBySlug(db, slug);
    if (!subject) continue;

    const sectionRows = await curriculumRepository.findSectionsBySubjectId(
      db,
      subject.id,
    );
    if (sectionRows.length === 0) continue;

    const chapterRows = await curriculumRepository.findChaptersBySectionIds(
      db,
      sectionRows.map((section) => section.id),
    );

    const chaptersBySection = new Map<string, CurriculumChapterOption[]>();
    for (const chapter of chapterRows) {
      const option: CurriculumChapterOption = {
        id: chapter.id,
        slug: chapter.slug,
        name: chapter.name,
        description: getChapterDescription(chapter.slug),
      };

      const bucket = chaptersBySection.get(chapter.sectionId);
      if (bucket) {
        bucket.push(option);
      } else {
        chaptersBySection.set(chapter.sectionId, [option]);
      }
    }

    result[slug] = sectionRows.map((section) => ({
      id: section.id,
      slug: section.slug,
      name: section.name,
      description: getSectionDescription(section.slug),
      chapters: chaptersBySection.get(section.id) ?? [],
    }));
  }

  return result;
}

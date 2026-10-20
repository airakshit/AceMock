import { inngest } from "../../../client";
import { db } from "@/db";
import { questionsRepository } from "@/features/questions/repositories/questions.repository";
import { classifyChapters, classifySections } from "./classify";
import {
  getPinnedSectionSlug,
  getSubjectName,
  loadCurriculumSections,
  toCurriculumSubject,
} from "./curriculum-map";
import {
  loadUnclassifiedClassifiableQuestions,
  type PendingClassifiableQuestion,
} from "./load-classifiable-questions";

export interface ClassifyQuestionsEventData {
  documentId: string;
}

export const CLASSIFY_QUESTIONS_EVENT = "documents/classify" as const;

/**
 * Questions per LLM call. Bounds prompt size while keeping the number of round
 * trips per document low — one call covers a whole batch, and one call per
 * section covers everything that landed in that section.
 */
const QUESTIONS_PER_BATCH = 25;

interface PendingCandidate {
  pending: PendingClassifiableQuestion;
  /** Set when the OCR tag already names the section (grammar / comprehension). */
  pinnedSectionSlug: string | null;
}

/**
 * Classifies a document's questions onto the seeded curriculum.
 *
 * Classification is incremental in two ways: only questions whose
 * `chapter_id` is still null are considered, so re-runs pick up exactly what
 * was skipped or failed; and the subject is never re-decided — the OCR pass
 * already produced it, so this only narrows section, then chapter.
 */
export const classifyQuestions = inngest.createFunction(
  {
    id: "classify-questions",
    triggers: { event: CLASSIFY_QUESTIONS_EVENT },
    retries: 2,
    // Two runs for one document must not race on `questions.chapter_id`.
    concurrency: { limit: 1, key: "event.data.documentId" },
  },
  async ({ event, step, logger }) => {
    const { documentId } = event.data as ClassifyQuestionsEventData;

    const pending = await step.run("load-unclassified-questions", () =>
      loadUnclassifiedClassifiableQuestions(documentId),
    );

    if (pending.length === 0) {
      logger.info({ documentId }, "No unclassified questions to process.");
      return {
        documentId,
        considered: 0,
        classified: 0,
        unclassified: 0,
        unmapped: 0,
      };
    }

    // 1. Place every question on the curriculum using the subject the OCR pass
    //    already decided. Anything we cannot place is left untouched.
    const bySubject = new Map<string, PendingCandidate[]>();
    let unmapped = 0;

    for (const item of pending) {
      const subjectSlug = toCurriculumSubject(item.subject);

      if (!subjectSlug) {
        unmapped += 1;
        continue;
      }

      const candidate: PendingCandidate = {
        pending: item,
        pinnedSectionSlug: getPinnedSectionSlug(item.subject),
      };

      const bucket = bySubject.get(subjectSlug);
      if (bucket) {
        bucket.push(candidate);
      } else {
        bySubject.set(subjectSlug, [candidate]);
      }
    }

    if (bySubject.size === 0) {
      return {
        documentId,
        considered: pending.length,
        classified: 0,
        unclassified: pending.length,
        unmapped,
      };
    }

    // 2. Load the seeded sections and chapters once, for every subject present.
    const curriculum = await step.run("load-curriculum", () =>
      loadCurriculumSections([...bySubject.keys()]),
    );

    const updates: Array<{ id: string; chapterId: string }> = [];

    for (const [subjectSlug, candidates] of bySubject) {
      const sections = curriculum[subjectSlug] ?? [];

      if (sections.length === 0) {
        logger.warn(
          { documentId, subjectSlug },
          "Subject has no sections in the curriculum; leaving questions unclassified.",
        );
        continue;
      }

      const subjectName = getSubjectName(subjectSlug) ?? subjectSlug;

      // 3a. A pinned section skips the section call entirely.
      const bySection = new Map<string, PendingClassifiableQuestion[]>();
      const needsSection: PendingClassifiableQuestion[] = [];

      for (const candidate of candidates) {
        const pinned = candidate.pinnedSectionSlug;
        const isKnown = pinned
          ? sections.some((section) => section.slug === pinned)
          : false;

        if (pinned && isKnown) {
          pushToMap(bySection, pinned, candidate.pending);
        } else {
          needsSection.push(candidate.pending);
        }
      }

      // 3b. Stage 1 — assign sections, in batches.
      for (
        let offset = 0;
        offset < needsSection.length;
        offset += QUESTIONS_PER_BATCH
      ) {
        const batch = needsSection.slice(offset, offset + QUESTIONS_PER_BATCH);

        const sectionSlugs = await step.run(
          `classify-sections-${subjectSlug}-${offset}`,
          () => classifySections({ subjectName, sections, questions: batch }),
        );

        sectionSlugs.forEach((slug, index) => {
          if (slug) pushToMap(bySection, slug, batch[index]);
        });
      }

      // 4. Stage 2 — assign chapters, batched per section.
      for (const [sectionSlug, batch] of bySection) {
        const section = sections.find((entry) => entry.slug === sectionSlug);

        if (!section || section.chapters.length === 0) {
          logger.warn(
            { documentId, sectionSlug },
            "Section has no chapters in the curriculum; leaving questions unclassified.",
          );
          continue;
        }

        for (
          let offset = 0;
          offset < batch.length;
          offset += QUESTIONS_PER_BATCH
        ) {
          const chunk = batch.slice(offset, offset + QUESTIONS_PER_BATCH);

          const chapterSlugs = await step.run(
            `classify-chapters-${sectionSlug}-${offset}`,
            () =>
              classifyChapters({
                subjectName,
                sectionName: section.name,
                chapters: section.chapters,
                questions: chunk,
              }),
          );

          chapterSlugs.forEach((slug, index) => {
            if (!slug) return;

            const chapter = section.chapters.find(
              (entry) => entry.slug === slug,
            );
            if (!chapter) return;

            updates.push({
              id: chunk[index].questionId,
              chapterId: chapter.id,
            });
          });
        }
      }
    }

    // 5. Persist — one batched write once every stage has resolved.
    if (updates.length > 0) {
      await step.run("persist-chapter-ids", () =>
        questionsRepository.updateManyChapterIds(db, updates),
      );
    }

    const classified = updates.length;

    logger.info(
      {
        documentId,
        considered: pending.length,
        classified,
        unclassified: pending.length - classified,
        unmapped,
      },
      "Question classification finished.",
    );

    return {
      documentId,
      considered: pending.length,
      classified,
      unclassified: pending.length - classified,
      unmapped,
    };
  },
);

function pushToMap(
  map: Map<string, PendingClassifiableQuestion[]>,
  key: string,
  value: PendingClassifiableQuestion,
): void {
  const bucket = map.get(key);
  if (bucket) {
    bucket.push(value);
  } else {
    map.set(key, [value]);
  }
}

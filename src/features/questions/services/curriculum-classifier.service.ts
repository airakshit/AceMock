import { CURRICULUM } from "@/constants/curriculum";
import { env } from "@/config/env/server";
import { GroqLLMService, GroqModels } from "@/services/llm";
import { DbExecutor } from "@/features/shared/types";
import { questionsRepository } from "../repositories/questions.repository";

export type CurriculumSubjectKey = "physics" | "chemistry" | "mathematics" | "english";

/**
 * Raw OCR subject values (lowercase) that the LLM produces during page extraction.
 * "grammar" and "comprehension" are English subtypes; we map them to "english".
 */
const OCR_SUBJECT_TO_CURRICULUM: Record<string, CurriculumSubjectKey> = {
  physics: "physics",
  chemistry: "chemistry",
  maths: "mathematics",
  math: "mathematics",
  mathematics: "mathematics",
  grammar: "english",
  comprehension: "english",
  english: "english",
};

export interface QuestionToClassify {
  id: string;
  question: string;
  options?: Array<{ key: string; text: string }>;
  /** Raw OCR subject: "physics" | "chemistry" | "maths" | "grammar" | "comprehension" */
  subject?: string | null;
  passageContent?: string | null;
}

export interface ClassifiedQuestionResult {
  id: string;
  chapterId: string;
  chapterSlug: string;
  sectionSlug: string;
  subjectSlug: CurriculumSubjectKey;
}

const BATCH_SIZE = 10;

export class CurriculumClassifierService {
  private llm: GroqLLMService;

  constructor() {
    this.llm = new GroqLLMService(env.GROQ_API_KEY, GroqModels.GPT_OSS_120B);
  }

  /**
   * Maps a raw OCR subject string to a CurriculumSubjectKey.
   * grammar → english, comprehension → english.
   * Returns null if the subject cannot be determined.
   */
  normalizeSubject(subjectInput?: string | null): CurriculumSubjectKey | null {
    if (!subjectInput) return null;
    const lower = subjectInput.toLowerCase().trim();
    return OCR_SUBJECT_TO_CURRICULUM[lower] ?? null;
  }

  /**
   * Identifies the curriculum subject for all questions.
   * Questions with OCR-tagged subjects are resolved immediately without an LLM call.
   * Only truly unknown questions are batched to Groq for detection.
   */
  async detectSubjects(
    questions: QuestionToClassify[],
  ): Promise<Map<string, CurriculumSubjectKey>> {
    const subjectMap = new Map<string, CurriculumSubjectKey>();
    const unknownQuestions: QuestionToClassify[] = [];

    for (const q of questions) {
      // Comprehension passage questions are always English
      if (q.passageContent) {
        subjectMap.set(q.id, "english");
        continue;
      }

      // Try to resolve from OCR-tagged subject (covers grammar, comprehension → english)
      const normalized = this.normalizeSubject(q.subject);
      if (normalized) {
        subjectMap.set(q.id, normalized);
      } else {
        unknownQuestions.push(q);
      }
    }

    if (unknownQuestions.length === 0) {
      return subjectMap;
    }

    // Batch identify truly unknown subjects via Groq
    for (let i = 0; i < unknownQuestions.length; i += BATCH_SIZE) {
      const batch = unknownQuestions.slice(i, i + BATCH_SIZE);
      try {
        const prompt = `You are an expert curriculum classifier for engineering entrance exams (e.g. IOE, CEE).
Available subjects: physics, chemistry, mathematics, english

Classify each question into exactly one of the 4 subjects.

Questions:
${batch
            .map(
              (q, idx) =>
                `${idx + 1}. [ID: ${q.id}] ${q.question.slice(0, 300)}` +
                (q.options?.length
                  ? ` | Options: ${q.options.map((o) => `${o.key}: ${o.text}`).join(", ")}`
                  : ""),
            )
            .join("\n")}`;

        const raw = await this.llm.call(
          prompt,
          undefined,
          undefined,
          {
            name: "subject_classification",
            schema: {
              type: "object",
              properties: {
                classifications: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      subject: {
                        type: "string",
                        enum: ["physics", "chemistry", "mathematics", "english"],
                      },
                    },
                    required: ["id", "subject"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["classifications"],
              additionalProperties: false,
            },
            strict: true,
          },
        );

        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed?.classifications)) {
            for (const item of parsed.classifications) {
              if (
                item.id &&
                typeof item.subject === "string" &&
                ["physics", "chemistry", "mathematics", "english"].includes(item.subject)
              ) {
                subjectMap.set(item.id, item.subject as CurriculumSubjectKey);
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to detect subject for batch:", err);
      }

      // Fallback for any still-unclassified questions in this batch
      for (const q of batch) {
        if (!subjectMap.has(q.id)) {
          // Best-effort fallback using question keywords
          const lower = (q.question + " " + (q.subject ?? "")).toLowerCase();
          if (lower.includes("chem") || lower.includes("reaction") || lower.includes("element")) {
            subjectMap.set(q.id, "chemistry");
          } else if (lower.includes("math") || lower.includes("calcul") || lower.includes("integr")) {
            subjectMap.set(q.id, "mathematics");
          } else if (lower.includes("passage") || lower.includes("grammar")) {
            subjectMap.set(q.id, "english");
          } else {
            subjectMap.set(q.id, "physics");
          }
        }
      }
    }

    return subjectMap;
  }

  /**
   * Step 1: Classifies the section for questions within a specific subject.
   * Only sections that belong to the given subject are shown to the LLM.
   */
  async classifySections(
    subject: CurriculumSubjectKey,
    questions: QuestionToClassify[],
  ): Promise<Map<string, string>> {
    const sectionMap = new Map<string, string>();
    const subjectDef = CURRICULUM[subject];
    if (!subjectDef || !subjectDef.sections) {
      return sectionMap;
    }

    const availableSections = Object.values(subjectDef.sections).map((s: any) => ({
      name: s.name as string,
      slug: s.slug as string,
    }));

    // Build a validation set for fast slug verification
    const validSectionSlugs = new Set(availableSections.map((s) => s.slug));
    const defaultSectionSlug = availableSections[0].slug;

    // If only one section exists, assign directly — no LLM call needed
    if (availableSections.length === 1) {
      for (const q of questions) {
        sectionMap.set(q.id, availableSections[0].slug);
      }
      return sectionMap;
    }

    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const batch = questions.slice(i, i + BATCH_SIZE);

      // English comprehension questions always go to "comprehension" section directly
      const questionsToQuery: QuestionToClassify[] = [];
      for (const q of batch) {
        if (subject === "english" && q.passageContent) {
          const comprehensionSection = availableSections.find((s) =>
            s.slug.includes("comprehension"),
          );
          sectionMap.set(q.id, comprehensionSection?.slug ?? defaultSectionSlug);
        } else {
          questionsToQuery.push(q);
        }
      }

      if (questionsToQuery.length === 0) continue;

      try {
        const sectionsListText = availableSections
          .map((s) => `- "${s.slug}": ${s.name}`)
          .join("\n");

        const sectionSlugEnum = availableSections.map((s) => s.slug);

        const prompt = `You are an expert curriculum classifier for engineering entrance exams.
Subject: ${subjectDef.name}

Available Sections (use the exact slug):
${sectionsListText}

Classify each question into one of the section slugs above.

Questions:
${questionsToQuery
            .map(
              (q, idx) =>
                `${idx + 1}. [ID: ${q.id}] ${q.question.slice(0, 300)}` +
                (q.options?.length
                  ? ` | Options: ${q.options.map((o) => `${o.key}: ${o.text}`).join(", ")}`
                  : ""),
            )
            .join("\n")}`;

        const raw = await this.llm.call(
          prompt,
          undefined,
          undefined,
          {
            name: "section_classification",
            schema: {
              type: "object",
              properties: {
                classifications: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      sectionSlug: {
                        type: "string",
                        enum: sectionSlugEnum,
                      },
                    },
                    required: ["id", "sectionSlug"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["classifications"],
              additionalProperties: false,
            },
            strict: true,
          },
        );

        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed?.classifications)) {
            for (const item of parsed.classifications) {
              // Strict validation: only accept slugs actually in this subject's sections
              if (item.id && typeof item.sectionSlug === "string" && validSectionSlugs.has(item.sectionSlug)) {
                sectionMap.set(item.id, item.sectionSlug);
              }
            }
          }
        }
      } catch (err) {
        console.error(`Failed to classify sections for subject ${subject}:`, err);
      }

      // Fallback for any unclassified in this batch
      for (const q of questionsToQuery) {
        if (!sectionMap.has(q.id)) {
          sectionMap.set(q.id, defaultSectionSlug);
        }
      }
    }

    return sectionMap;
  }

  /**
   * Step 2: Classifies the chapter for questions within a specific section.
   * Only chapters that belong to the given section are shown to the LLM.
   */
  async classifyChapters(
    subject: CurriculumSubjectKey,
    sectionSlug: string,
    questions: QuestionToClassify[],
  ): Promise<Map<string, string>> {
    const chapterMap = new Map<string, string>();
    const subjectDef = CURRICULUM[subject];
    if (!subjectDef || !subjectDef.sections) {
      return chapterMap;
    }

    const sectionDef = Object.values(subjectDef.sections).find(
      (s: any) => s.slug === sectionSlug,
    ) as any;

    if (!sectionDef || !sectionDef.chapters || sectionDef.chapters.length === 0) {
      return chapterMap;
    }

    const availableChapters: Array<{ name: string; slug: string }> = sectionDef.chapters.map(
      (c: any) => ({ name: c.name as string, slug: c.slug as string }),
    );

    // Build a validation set for fast slug verification
    const validChapterSlugs = new Set(availableChapters.map((c) => c.slug));
    const defaultChapterSlug = availableChapters[0].slug;

    // If only 1 chapter exists, map directly without an LLM call
    if (availableChapters.length === 1) {
      for (const q of questions) {
        chapterMap.set(q.id, availableChapters[0].slug);
      }
      return chapterMap;
    }

    const chapterSlugEnum = availableChapters.map((c) => c.slug);

    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const batch = questions.slice(i, i + BATCH_SIZE);

      try {
        const chaptersListText = availableChapters
          .map((c) => `- "${c.slug}": ${c.name}`)
          .join("\n");

        const prompt = `You are an expert curriculum classifier for engineering entrance exams.
Subject: ${subjectDef.name}
Section: ${sectionDef.name}

Available Chapters (use the exact slug):
${chaptersListText}

Classify each question into one of the chapter slugs above.

Questions:
${batch
            .map(
              (q, idx) =>
                `${idx + 1}. [ID: ${q.id}] ${q.question.slice(0, 300)}` +
                (q.options?.length
                  ? ` | Options: ${q.options.map((o) => `${o.key}: ${o.text}`).join(", ")}`
                  : ""),
            )
            .join("\n")}`;

        const raw = await this.llm.call(
          prompt,
          undefined,
          undefined,
          {
            name: "chapter_classification",
            schema: {
              type: "object",
              properties: {
                classifications: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      chapterSlug: {
                        type: "string",
                        enum: chapterSlugEnum,
                      },
                    },
                    required: ["id", "chapterSlug"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["classifications"],
              additionalProperties: false,
            },
            strict: true,
          },
        );

        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed?.classifications)) {
            for (const item of parsed.classifications) {
              // Strict validation: only accept slugs actually in this section
              if (item.id && typeof item.chapterSlug === "string" && validChapterSlugs.has(item.chapterSlug)) {
                chapterMap.set(item.id, item.chapterSlug);
              }
            }
          }
        }
      } catch (err) {
        console.error(
          `Failed to classify chapters for section ${sectionSlug}:`,
          err,
        );
      }

      // Fallback for any unclassified in this batch
      for (const q of batch) {
        if (!chapterMap.has(q.id)) {
          chapterMap.set(q.id, defaultChapterSlug);
        }
      }
    }

    return chapterMap;
  }

  /**
   * Main incremental classification orchestrator:
   * 1. Normalizes OCR subjects → curriculum subjects (grammar/comprehension → english).
   * 2. Groups questions by curriculum subject.
   * 3. For each subject: classifies section from ONLY that subject's sections.
   * 4. For each section: classifies chapter from ONLY that section's chapters.
   * 5. Resolves database chapterId from slug.
   */
  async classifyQuestions(
    db: DbExecutor,
    questions: QuestionToClassify[],
  ): Promise<ClassifiedQuestionResult[]> {
    if (questions.length === 0) return [];

    // 1. Fetch DB chapters cache for O(1) slug → UUID resolution
    const dbChaptersMap = await questionsRepository.getAllChaptersMap(db);

    // 2. Detect/normalize subjects for all questions
    const subjectMap = await this.detectSubjects(questions);

    // 3. Group questions by curriculum subject
    const subjectGroups = new Map<CurriculumSubjectKey, QuestionToClassify[]>();
    for (const q of questions) {
      const subj = subjectMap.get(q.id);
      if (!subj) continue; // should not happen; detectSubjects always assigns
      if (!subjectGroups.has(subj)) {
        subjectGroups.set(subj, []);
      }
      subjectGroups.get(subj)!.push(q);
    }

    const results: ClassifiedQuestionResult[] = [];

    // 4. For each subject group, run 2-step classification
    for (const [subject, subjectQuestions] of subjectGroups.entries()) {
      // Step 1: Classify section (only sections of this subject are in scope)
      const sectionMap = await this.classifySections(subject, subjectQuestions);

      // Group questions by classified section
      const sectionGroups = new Map<string, QuestionToClassify[]>();
      for (const q of subjectQuestions) {
        const secSlug = sectionMap.get(q.id);
        if (!secSlug) continue; // classifySections always assigns via fallback
        if (!sectionGroups.has(secSlug)) {
          sectionGroups.set(secSlug, []);
        }
        sectionGroups.get(secSlug)!.push(q);
      }

      // Step 2: Classify chapter (only chapters of this section are in scope)
      for (const [sectionSlug, secQuestions] of sectionGroups.entries()) {
        const chapterMap = await this.classifyChapters(
          subject,
          sectionSlug,
          secQuestions,
        );

        for (const q of secQuestions) {
          const chapterSlug = chapterMap.get(q.id);
          let resolvedChapterId: string | null = null;

          if (chapterSlug && dbChaptersMap.has(chapterSlug)) {
            resolvedChapterId = dbChaptersMap.get(chapterSlug)!.id;
          }

          // Fallback: find default chapter for this subject if slug not in DB
          if (!resolvedChapterId) {
            console.warn(
              `Chapter slug "${chapterSlug}" not found in DB for subject ${subject}/${sectionSlug}. Using subject default.`,
            );
            resolvedChapterId =
              await questionsRepository.findOrCreateDefaultChapter(db, subject);
          }

          results.push({
            id: q.id,
            chapterId: resolvedChapterId,
            chapterSlug: chapterSlug ?? `fallback-${subject}`,
            sectionSlug,
            subjectSlug: subject,
          });
        }
      }
    }

    return results;
  }
}

export const curriculumClassifierService = new CurriculumClassifierService();

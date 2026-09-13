import { CURRICULUM } from "@/constants/curriculum";
import { env } from "@/config/env/server";
import { GroqLLMService, GroqModels } from "@/services/llm";
import { DbExecutor } from "@/features/shared/types";
import { questionsRepository } from "../repositories/questions.repository";

export type CurriculumSubjectKey = "physics" | "chemistry" | "mathematics" | "english";

export interface QuestionToClassify {
  id: string;
  question: string;
  options?: Array<{ key: string; text: string }>;
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
   * Normalizes raw subject string from OCR into a known curriculum subject key.
   */
  normalizeSubject(subjectInput?: string | null): CurriculumSubjectKey | null {
    if (!subjectInput) return null;
    const lower = subjectInput.toLowerCase().trim();

    if (lower.includes("phys")) return "physics";
    if (lower.includes("chem")) return "chemistry";
    if (lower.includes("math")) return "mathematics";
    if (
      lower.includes("eng") ||
      lower.includes("gram") ||
      lower.includes("comp") ||
      lower.includes("passage") ||
      lower.includes("reading")
    ) {
      return "english";
    }

    return null;
  }

  /**
   * Identifies the subject for questions where subject is unknown or general.
   */
  async detectSubjects(
    questions: QuestionToClassify[],
  ): Promise<Map<string, CurriculumSubjectKey>> {
    const subjectMap = new Map<string, CurriculumSubjectKey>();
    const unknownQuestions: QuestionToClassify[] = [];

    for (const q of questions) {
      if (q.passageContent) {
        // Comprehension passages are part of English
        subjectMap.set(q.id, "english");
        continue;
      }

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

    // Batch identify unknown subjects via Groq
    for (let i = 0; i < unknownQuestions.length; i += BATCH_SIZE) {
      const batch = unknownQuestions.slice(i, i + BATCH_SIZE);
      try {
        const prompt = `You are an expert curriculum classifier for entrance exams.
Available subjects:
- physics
- chemistry
- mathematics
- english

Classify each question into one of the 4 subjects above.

Questions:
${batch
  .map(
    (q, idx) =>
      `${idx + 1}. [ID: ${q.id}] Question: ${q.question.slice(0, 300)}` +
      (q.options?.length
        ? ` Options: ${q.options.map((o) => `${o.key}: ${o.text}`).join(", ")}`
        : ""),
  )
  .join("\n")}

Respond in JSON adhering to this schema:
{
  "classifications": [
    { "id": "question_id", "subject": "physics|chemistry|mathematics|english" }
  ]
}`;

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
              if (item.id && item.subject) {
                subjectMap.set(item.id, item.subject as CurriculumSubjectKey);
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to detect subject for batch:", err);
      }

      // Default fallback for any unclassified in this batch
      for (const q of batch) {
        if (!subjectMap.has(q.id)) {
          subjectMap.set(q.id, "physics");
        }
      }
    }

    return subjectMap;
  }

  /**
   * Step 1: Classifies the section for a batch of questions within a known subject.
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

    if (availableSections.length === 1) {
      for (const q of questions) {
        sectionMap.set(q.id, availableSections[0].slug);
      }
      return sectionMap;
    }

    const defaultSectionSlug = availableSections[0].slug;

    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const batch = questions.slice(i, i + BATCH_SIZE);

      // Check for reading comprehension passage directly
      const questionsToQuery: QuestionToClassify[] = [];
      for (const q of batch) {
        if (subject === "english" && q.passageContent) {
          sectionMap.set(q.id, "comprehension");
        } else {
          questionsToQuery.push(q);
        }
      }

      if (questionsToQuery.length === 0) continue;

      try {
        const sectionsListText = availableSections
          .map((s) => `- ${s.name} (slug: "${s.slug}")`)
          .join("\n");

        const prompt = `You are an expert curriculum classifier for engineering entrance exams.
Subject: ${subjectDef.name}

Available Sections:
${sectionsListText}

Classify each question into the single most appropriate Section slug from the list above.

Questions:
${questionsToQuery
  .map(
    (q, idx) =>
      `${idx + 1}. [ID: ${q.id}] Question: ${q.question.slice(0, 300)}` +
      (q.options?.length
        ? ` Options: ${q.options.map((o) => `${o.key}: ${o.text}`).join(", ")}`
        : ""),
  )
  .join("\n")}

Respond with JSON adhering to this schema:
{
  "classifications": [
    { "id": "question_id", "sectionSlug": "slug_of_section" }
  ]
}`;

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
                      sectionSlug: { type: "string" },
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
              const matched = availableSections.find(
                (s) => s.slug === item.sectionSlug,
              );
              if (matched) {
                sectionMap.set(item.id, matched.slug);
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
   * Step 2: Classifies the chapter for a batch of questions within a known section.
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

    const availableChapters = sectionDef.chapters.map((c: any) => ({
      name: c.name as string,
      slug: c.slug as string,
    }));

    // If only 1 chapter exists in this section, map directly without an LLM call
    if (availableChapters.length === 1) {
      for (const q of questions) {
        chapterMap.set(q.id, availableChapters[0].slug);
      }
      return chapterMap;
    }

    const defaultChapterSlug = availableChapters[0].slug;

    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const batch = questions.slice(i, i + BATCH_SIZE);

      try {
        const chaptersListText = availableChapters
          .map((c: any) => `- ${c.name} (slug: "${c.slug}")`)
          .join("\n");

        const prompt = `You are an expert curriculum classifier for engineering entrance exams.
Subject: ${subjectDef.name}
Section: ${sectionDef.name}

Available Chapters:
${chaptersListText}

Classify each question into the single most appropriate Chapter slug from the list above.

Questions:
${batch
  .map(
    (q, idx) =>
      `${idx + 1}. [ID: ${q.id}] Question: ${q.question.slice(0, 300)}` +
      (q.options?.length
        ? ` Options: ${q.options.map((o) => `${o.key}: ${o.text}`).join(", ")}`
        : ""),
  )
  .join("\n")}

Respond with JSON adhering to this schema:
{
  "classifications": [
    { "id": "question_id", "chapterSlug": "slug_of_chapter" }
  ]
}`;

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
                      chapterSlug: { type: "string" },
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
              const matched = availableChapters.find(
                (c: any) => c.slug === item.chapterSlug,
              );
              if (matched) {
                chapterMap.set(item.id, matched.slug);
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
   * 1. Detects/normalizes subject.
   * 2. Step 1: Classifies Section.
   * 3. Step 2: Classifies Chapter within Section.
   * 4. Resolves database chapterId from slug.
   */
  async classifyQuestions(
    db: DbExecutor,
    questions: QuestionToClassify[],
  ): Promise<ClassifiedQuestionResult[]> {
    if (questions.length === 0) return [];

    // 1. Fetch DB chapters cache for O(1) slug resolution
    const dbChaptersMap = await questionsRepository.getAllChaptersMap(db);

    // 2. Identify subjects for all questions
    const subjectMap = await this.detectSubjects(questions);

    // Group questions by subject
    const subjectGroups = new Map<CurriculumSubjectKey, QuestionToClassify[]>();
    for (const q of questions) {
      const subj = subjectMap.get(q.id) || "physics";
      if (!subjectGroups.has(subj)) {
        subjectGroups.set(subj, []);
      }
      subjectGroups.get(subj)!.push(q);
    }

    const results: ClassifiedQuestionResult[] = [];

    // 3. For each subject, run 2-step classification
    for (const [subject, subjectQuestions] of subjectGroups.entries()) {
      // Step 1: Section classification
      const sectionMap = await this.classifySections(subject, subjectQuestions);

      // Group questions by classified section
      const sectionGroups = new Map<string, QuestionToClassify[]>();
      for (const q of subjectQuestions) {
        const secSlug = sectionMap.get(q.id) || "general";
        if (!sectionGroups.has(secSlug)) {
          sectionGroups.set(secSlug, []);
        }
        sectionGroups.get(secSlug)!.push(q);
      }

      // Step 2: Chapter classification per section
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

          // Fallback: lookup default chapter for subject if not found
          if (!resolvedChapterId) {
            resolvedChapterId =
              await questionsRepository.findOrCreateDefaultChapter(db, subject);
          }

          results.push({
            id: q.id,
            chapterId: resolvedChapterId,
            chapterSlug: chapterSlug || `uncategorized-${subject}`,
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

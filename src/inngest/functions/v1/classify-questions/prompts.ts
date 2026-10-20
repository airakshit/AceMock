import type { ClassifiableQuestion } from "./classifiable-question-schema";

/**
 * One selectable outcome for a classification stage. Slugs are the stable
 * identity; names and descriptions exist purely to help the model choose.
 */
export interface ClassificationCandidate {
  slug: string;
  name: string;
  description?: string | null;
}

const SECTION_RULES = `Rules:
- Classify every question listed below; do not skip any.
- Base the choice on the concepts actually being tested, not on the wording of the question.
- Every question belongs to exactly one section of the subject named above.`;

const CHAPTER_RULES = `Rules:
- Classify every question listed below; do not skip any.
- Choose the narrowest chapter that fully covers what the question tests.
- Every question belongs to exactly one chapter of the section named above.`;

function formatCandidates(candidates: ClassificationCandidate[]): string {
  return candidates
    .map((candidate) => {
      const description = candidate.description?.trim();
      return `- ${candidate.slug} | ${candidate.name}${
        description ? ` — ${description}` : ""
      }`;
    })
    .join("\n");
}

function formatQuestions(questions: ClassifiableQuestion[]): string {
  return questions
    .map((question, index) => {
      const options = question.options
        .map((option) => `(${option.key}) ${option.text}`)
        .join(" ");
      const optionLine = options ? `\n    ${options}` : "";
      return `[${index}] ${question.question}${optionLine}`;
    })
    .join("\n");
}

export function buildSectionClassificationPrompt(input: {
  subjectName: string;
  sections: ClassificationCandidate[];
  questions: ClassifiableQuestion[];
}): string {
  return `You are classifying exam questions onto a curriculum.

Subject: ${input.subjectName}

Choose the best section for each question from this list:
${formatCandidates(input.sections)}

Questions:
${formatQuestions(input.questions)}

${SECTION_RULES}

Return JSON matching the required schema, with one entry per question.`;
}

export function buildChapterClassificationPrompt(input: {
  subjectName: string;
  sectionName: string;
  chapters: ClassificationCandidate[];
  questions: ClassifiableQuestion[];
}): string {
  return `You are classifying exam questions onto a curriculum.

Subject: ${input.subjectName}
Section: ${input.sectionName}

Choose the best chapter for each question from this list:
${formatCandidates(input.chapters)}

Questions:
${formatQuestions(input.questions)}

${CHAPTER_RULES}

Return JSON matching the required schema, with one entry per question.`;
}

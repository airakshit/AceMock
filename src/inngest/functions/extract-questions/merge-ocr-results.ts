import type { QuestionOption } from "@/features/questions/types";
import type { OcrPageResult, ResolvedQuestion } from "./ocr-types";
import { parseAndValidateStructuredOCR } from "./utils";
import { QuestionMergeError } from "./errors";
import type { StructuredSchemaParseResult } from "./schema";

interface MergedQuestionRecord {
  serialNo: number;
  fileId: string;
  pageNos: number[];
  questionText: string;
  optionsMap: Partial<Record<"A" | "B" | "C" | "D", string>>;
  answerKey: string;
  subject?: string;
  marks: number;
  solution?: string;
  svgQuestion?: string;
  svgSolution?: string;
  svgOptionsMap: Partial<Record<"A" | "B" | "C" | "D", string>>;
  passageContent?: string | null;
  incomplete: boolean;
  optionIncomplete: boolean;
}

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

/**
 * Checks if a question's serial number falls within a section's defined bounds.
 */
function isItemInSection(
  serialNo: number,
  start?: number,
  end?: number,
): boolean {
  if (start !== undefined && end !== undefined) {
    return serialNo >= start && serialNo <= end;
  }
  if (start !== undefined) {
    return serialNo >= start;
  }
  if (end !== undefined) {
    return serialNo <= end;
  }
  return true;
}

/**
 * Merges raw and structured OCR page results across all pages of a document:
 * 1. Groups questions by serial number in sequential page order.
 * 2. Resolves cross-page question text continuations.
 * 3. Resolves split options across page boundaries.
 * 4. Merges answer keys and solutions located on different pages.
 * 5. Associates comprehension passages with questions.
 * 6. Returns clean, validated ResolvedQuestion array sorted by serialNo.
 */
export function mergeOcrResults(
  ocrResults: OcrPageResult[],
): ResolvedQuestion[] {
  try {
    // 1. Sort pages ascending by page number
    const sortedPages = [...ocrResults].sort((a, b) => a.pageNo - b.pageNo);

    const mergedMap = new Map<number, MergedQuestionRecord>();

    for (const page of sortedPages) {
      // Skip failed or non-relevant pages
      if (page.status !== "success" || page.isRelevant === false) {
        continue;
      }

      // Retrieve or re-parse structured data
      let structuredData: StructuredSchemaParseResult | undefined =
        page.parsedData;

      if (!structuredData && page.rawText) {
        const parsed = parseAndValidateStructuredOCR(page.rawText);
        if (parsed.parsedStructuredData) {
          structuredData = parsed.parsedStructuredData;
        }
      }

      if (!structuredData || !Array.isArray(structuredData.data)) {
        continue;
      }

      const {
        sectionStart,
        sectionEnd,
        eachMarks,
        paragraph,
        data: items,
      } = structuredData;

      for (const item of items) {
        if (!item || typeof item.serialNo !== "number" || item.serialNo <= 0) {
          continue;
        }

        const serialNo = item.serialNo;
        const existing = mergedMap.get(serialNo);

        const hasPassage =
          paragraph && isItemInSection(serialNo, sectionStart, sectionEnd);

        if (!existing) {
          // Initialize fresh record for this serialNo
          const optionsMap: Partial<Record<"A" | "B" | "C" | "D", string>> = {};
          if (item.options) {
            for (const key of OPTION_KEYS) {
              if (item.options[key] !== undefined && item.options[key] !== null) {
                optionsMap[key] = item.options[key]!.trim();
              }
            }
          }

          const svgOptionsMap: Partial<Record<"A" | "B" | "C" | "D", string>> = {};
          if (item.svgOptions) {
            for (const key of OPTION_KEYS) {
              if (item.svgOptions[key]) {
                svgOptionsMap[key] = item.svgOptions[key]!;
              }
            }
          }

          mergedMap.set(serialNo, {
            serialNo,
            fileId: page.fileId,
            pageNos: [page.pageNo],
            questionText: item.question?.trim() ?? "",
            optionsMap,
            answerKey: item.answerKey?.trim() ?? "",
            subject: item.subject?.trim(),
            marks: item.marks ?? eachMarks ?? 1,
            solution: item.solution?.trim(),
            svgQuestion: item.svgQuestion?.trim(),
            svgSolution: item.svgSolution?.trim(),
            svgOptionsMap,
            passageContent: hasPassage ? paragraph.trim() : null,
            incomplete: Boolean(item.incomplete),
            optionIncomplete: Boolean(item.optionIncomplete),
          });
        } else {
          // Merge with previously encountered record for this serialNo
          existing.pageNos.push(page.pageNo);

          // Merge Question Text
          if (item.question?.trim()) {
            const nextText = item.question.trim();
            if (
              existing.incomplete ||
              item.isContinuation ||
              !existing.questionText
            ) {
              existing.questionText = existing.questionText
                ? `${existing.questionText} ${nextText}`
                : nextText;
            } else if (!existing.questionText.includes(nextText)) {
              // Append if not a duplicate
              existing.questionText = `${existing.questionText} ${nextText}`;
            }
          }

          // Merge Options
          if (item.options) {
            for (const key of OPTION_KEYS) {
              const optText = item.options[key]?.trim();
              if (optText) {
                if (existing.optionIncomplete && existing.optionsMap[key]) {
                  existing.optionsMap[key] =
                    `${existing.optionsMap[key]} ${optText}`.trim();
                } else if (!existing.optionsMap[key]) {
                  existing.optionsMap[key] = optText;
                }
              }
            }
          }

          // Merge Answer Key
          if (item.answerKey?.trim()) {
            existing.answerKey = item.answerKey.trim();
          }

          // Merge Solution
          if (item.solution?.trim()) {
            const nextSolution = item.solution.trim();
            if (existing.solution) {
              if (!existing.solution.includes(nextSolution)) {
                existing.solution = `${existing.solution}\n${nextSolution}`;
              }
            } else {
              existing.solution = nextSolution;
            }
          }

          // Merge Subject
          if (!existing.subject && item.subject?.trim()) {
            existing.subject = item.subject.trim();
          }

          // Merge Marks
          if (item.marks) {
            existing.marks = item.marks;
          }

          // Merge SVGs
          if (item.svgQuestion?.trim()) {
            existing.svgQuestion = existing.svgQuestion
              ? `${existing.svgQuestion}\n${item.svgQuestion.trim()}`
              : item.svgQuestion.trim();
          }
          if (item.svgSolution?.trim()) {
            existing.svgSolution = existing.svgSolution
              ? `${existing.svgSolution}\n${item.svgSolution.trim()}`
              : item.svgSolution.trim();
          }
          if (item.svgOptions) {
            for (const key of OPTION_KEYS) {
              if (item.svgOptions[key]) {
                existing.svgOptionsMap[key] = item.svgOptions[key]!;
              }
            }
          }

          // Merge Passage if missing
          if (!existing.passageContent && hasPassage && paragraph) {
            existing.passageContent = paragraph.trim();
          }

          // Update continuation flags
          existing.incomplete = Boolean(item.incomplete);
          existing.optionIncomplete = Boolean(item.optionIncomplete);
        }
      }
    }

    // 2. Transform merged state into ResolvedQuestion entities
    const resolvedQuestions: ResolvedQuestion[] = [];

    for (const record of mergedMap.values()) {
      // Build options array
      const options: QuestionOption[] = [];
      for (const key of OPTION_KEYS) {
        const text = record.optionsMap[key];
        if (text && text.trim().length > 0) {
          options.push({
            key,
            text: text.trim(),
          });
        }
      }

      // If question text is completely empty but has options or solution, provide fallback
      let finalQuestionText = record.questionText.trim();
      if (!finalQuestionText) {
        if (options.length > 0 || record.solution) {
          finalQuestionText = `Question ${record.serialNo}`;
        } else {
          // Incomplete ghost record with neither question nor options; skip
          continue;
        }
      }

      // Determine correctOption (default to first option or "A" if unextracted)
      let correctOption = "A";
      if (record.answerKey && OPTION_KEYS.includes(record.answerKey as any)) {
        correctOption = record.answerKey;
      } else if (options.length > 0) {
        correctOption = options[0].key;
      }

      resolvedQuestions.push({
        serialNo: record.serialNo,
        fileId: record.fileId,
        question: finalQuestionText,
        options,
        correctOption,
        marks: Math.max(1, record.marks || 1),
        difficulty: "medium",
        subject: record.subject,
        solution: record.solution || null,
        hint: null,
        diagram_url: null,
        solution_diagram_url: null,
        passageId: null,
        passageContent: record.passageContent || null,
        svgQuestion: record.svgQuestion || null,
        svgSolution: record.svgSolution || null,
      });
    }

    // 3. Return sorted by serialNo
    return resolvedQuestions.sort((a, b) => a.serialNo - b.serialNo);
  } catch (error) {
    if (error instanceof QuestionMergeError) {
      throw error;
    }
    throw new QuestionMergeError(
      `Failed to merge OCR results: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

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
 * State tracking an active reading comprehension passage across consecutive pages.
 */
export interface ActivePassageState {
  content: string;
  sourcePageNo: number;
  sectionStart?: number;
  sectionEnd?: number;
  questionsAssignedCount: number;
  lastAssignedSerialNo?: number;
  lastAssignedPageNo?: number;
  isClosed: boolean;
}

/**
 * Normalizes passage text for comparison by collapsing whitespace and lowercasing.
 */
export function normalizePassageText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Checks if two passage texts are substantially identical (e.g. repeated across pages).
 */
export function arePassagesSimilar(p1: string, p2: string): boolean {
  const norm1 = normalizePassageText(p1);
  const norm2 = normalizePassageText(p2);
  if (norm1 === norm2) return true;
  if (norm1.length > 50 && norm2.length > 50) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      const minLen = Math.min(norm1.length, norm2.length);
      const maxLen = Math.max(norm1.length, norm2.length);
      if (minLen / maxLen > 0.8) return true;
    }
  }
  return false;
}

/**
 * Attempts to extract question serial range (e.g. "Questions 41 to 45", "Q. 1-5")
 * from section labels, passage directions, or headers.
 */
export function extractSectionRange(
  text?: string | null,
): { start: number; end: number } | null {
  if (!text) return null;
  const match = text.match(
    /(?:questions?|q\.?\s*(?:nos?\.?)?)\s*\(?\s*(\d+)\s*(?:to|-|–|—)\s*(\d+)\s*\)?/i,
  );
  if (match) {
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    if (!isNaN(start) && !isNaN(end) && start <= end && end - start <= 20) {
      return { start, end };
    }
  }
  return null;
}

/**
 * Checks if text contains STEM / math / science indicators that indicate non-comprehension.
 */
export function containsSTEMIndicators(text?: string | null): boolean {
  if (!text) return false;
  return /\$|\\frac|\\sqrt|\\int|\\sum|\\ce\{|\\times|\\approx|\\pm|\\alpha|\\beta|\\theta|\b(dx|dy|dt)\b/i.test(
    text,
  );
}

/**
 * Checks if question text contains explicit reading comprehension keywords.
 */
export function hasPassageQuestionKeywords(text?: string | null): boolean {
  if (!text) return false;
  return /\b(according to the passage|in the passage|author('s)? view|author implies|passage suggests|passage mentions|based on the passage|central theme of the passage|tone of the passage)\b/i.test(
    text,
  );
}

/**
 * Determines whether an entity represents a Reading Comprehension question.
 */
export function isComprehensionQuestion(
  item: { subject?: string | null; question?: string | null },
  existingRecord?: MergedQuestionRecord | null,
  sectionLabel?: string | null,
  activePassage?: ActivePassageState | null,
  serialNo?: number,
): boolean {
  const currentSub = (item.subject || existingRecord?.subject || "")
    .toLowerCase()
    .trim();

  // 1. Definite negative: non-comprehension subjects
  if (
    currentSub === "maths" ||
    currentSub === "math" ||
    currentSub === "mathematics" ||
    currentSub === "physics" ||
    currentSub === "chemistry" ||
    currentSub === "grammar"
  ) {
    return false;
  }

  // 2. STEM indicators in question text (e.g. math equations) indicate non-comprehension
  const qText = item.question || existingRecord?.questionText || "";
  if (containsSTEMIndicators(qText)) {
    return false;
  }

  // 3. Definite positive: marked as comprehension
  if (currentSub === "comprehension") {
    return true;
  }

  // 4. Explicit question text referencing the passage
  if (hasPassageQuestionKeywords(qText)) {
    return true;
  }

  // 5. Section label checks
  if (sectionLabel) {
    const labelLower = sectionLabel.toLowerCase();
    if (
      labelLower.includes("comprehension") ||
      labelLower.includes("passage") ||
      labelLower.includes("reading")
    ) {
      return true;
    }
    if (
      labelLower.includes("math") ||
      labelLower.includes("physics") ||
      labelLower.includes("chemistry") ||
      labelLower.includes("grammar")
    ) {
      return false;
    }
  }

  // 6. If subject is not set, but within activePassage's explicit range:
  if (
    activePassage &&
    !activePassage.isClosed &&
    serialNo !== undefined &&
    activePassage.sectionStart !== undefined &&
    activePassage.sectionEnd !== undefined
  ) {
    if (
      serialNo >= activePassage.sectionStart &&
      serialNo <= activePassage.sectionEnd
    ) {
      return true;
    }
  }

  // 7. If consecutive question immediately following an assigned comprehension question
  if (
    activePassage &&
    !activePassage.isClosed &&
    activePassage.questionsAssignedCount > 0 &&
    activePassage.lastAssignedSerialNo !== undefined &&
    serialNo !== undefined &&
    serialNo === activePassage.lastAssignedSerialNo + 1
  ) {
    return true;
  }

  return false;
}

/**
 * Cleans option text by stripping redundant leading labels, e.g. "(A)", "A.", "a)", "1."
 */
export function cleanOptionText(text: string): string {
  if (!text) return "";
  return text
    .replace(/^(\([A-Da-d0-9]\)|[A-Da-d0-9][\.\)]|\b[A-Da-d]\b\s*[:\-])\s*/, "")
    .trim();
}

/**
 * Cleans question text by stripping leading serial number if present in text.
 */
export function cleanQuestionText(question: string, serialNo?: number): string {
  if (!question) return "";
  let cleaned = question.trim();

  if (serialNo !== undefined) {
    const serialRegex = new RegExp(
      `^(Q\\.?\\s*${serialNo}[\\.\\:\\)]|${serialNo}[\\.\\:\\)])\\s*`,
      "i",
    );
    cleaned = cleaned.replace(serialRegex, "").trim();
  } else {
    cleaned = cleaned
      .replace(/^(Q\.?\s*\d+[\.\:\)]|\d+[\.\:\)])\s*/i, "")
      .trim();
  }

  return cleaned;
}

/**
 * Merges raw and structured OCR page results across all pages of a document:
 * 1. Groups questions by serial number in sequential page order.
 * 2. Resolves cross-page question text continuations.
 * 3. Resolves split options across page boundaries.
 * 4. Merges answer keys and solutions located on different pages.
 * 5. Uses an order-based active passage system to associate reading comprehension
 *    passages exclusively with their respective comprehension questions across pages.
 * 6. Returns clean, validated ResolvedQuestion array sorted by serialNo.
 */
export function mergeOcrResults(
  ocrResults: OcrPageResult[],
): ResolvedQuestion[] {
  try {
    // 1. Sort pages ascending by page number
    const sortedPages = [...ocrResults].sort((a, b) => a.pageNo - b.pageNo);

    const mergedMap = new Map<number, MergedQuestionRecord>();
    let activePassage: ActivePassageState | null = null;

    for (const page of sortedPages) {
      // Skip failed or non-relevant pages
      if (page.status !== "completed" || page.isRelevant === false) {
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
        sectionLabel,
        sectionStart,
        sectionEnd,
        eachMarks,
        paragraph,
        data: items,
      } = structuredData;

      // Check if this page introduces or modifies a reading passage
      const pageParagraph = paragraph?.trim();
      if (pageParagraph && pageParagraph.length > 20) {
        if (
          activePassage &&
          arePassagesSimilar(pageParagraph, activePassage.content)
        ) {
          // Same passage repeated across pages; keep active, update range if applicable
          if (
            sectionEnd &&
            (!activePassage.sectionEnd || sectionEnd > activePassage.sectionEnd)
          ) {
            activePassage.sectionEnd = sectionEnd;
          }
        } else {
          // New distinct passage encountered! Transition activePassage to this new passage
          let pStart = sectionStart;
          let pEnd = sectionEnd;

          // If range is missing or broad (> 20 questions), try extracting tighter range from text/labels
          if (
            pStart === undefined ||
            pEnd === undefined ||
            (pEnd && pStart && pEnd - pStart > 20)
          ) {
            const extracted =
              extractSectionRange(sectionLabel) ||
              extractSectionRange(pageParagraph.slice(0, 300));
            if (extracted) {
              pStart = extracted.start;
              pEnd = extracted.end;
            }
          }

          activePassage = {
            content: pageParagraph,
            sourcePageNo: page.pageNo,
            sectionStart: pStart,
            sectionEnd: pEnd,
            questionsAssignedCount: 0,
            lastAssignedSerialNo: undefined,
            lastAssignedPageNo: undefined,
            isClosed: false,
          };
        }
      } else if (activePassage && !activePassage.isClosed) {
        // Page has no paragraph. Check if active passage should expire due to page distance
        const lastPage =
          activePassage.lastAssignedPageNo ?? activePassage.sourcePageNo;
        if (page.pageNo - lastPage > 2) {
          activePassage.isClosed = true;
        }

        // Also check if page section header explicitly indicates another subject
        if (sectionLabel) {
          const sLower = sectionLabel.toLowerCase();
          if (
            sLower.includes("math") ||
            sLower.includes("physics") ||
            sLower.includes("chemistry") ||
            sLower.includes("grammar")
          ) {
            activePassage.isClosed = true;
          }
        }
      }

      for (const item of items) {
        if (!item || typeof item.serialNo !== "number" || item.serialNo <= 0) {
          continue;
        }

        const serialNo = item.serialNo;
        const existing = mergedMap.get(serialNo);

        // Determine if item is a comprehension question
        const isComprehension = isComprehensionQuestion(
          item,
          existing,
          sectionLabel,
          activePassage,
          serialNo,
        );

        let itemPassageContent: string | null = null;

        if (isComprehension) {
          if (activePassage && !activePassage.isClosed) {
            const isBeforeStart =
              activePassage.sectionStart !== undefined &&
              serialNo < activePassage.sectionStart;
            const isAfterEnd =
              activePassage.sectionEnd !== undefined &&
              serialNo > activePassage.sectionEnd;

            if (isAfterEnd) {
              // Reached beyond sectionEnd, close active passage
              activePassage.isClosed = true;
            } else if (!isBeforeStart) {
              // Within valid bounds! Assign passage
              itemPassageContent = activePassage.content;
              activePassage.questionsAssignedCount++;
              activePassage.lastAssignedSerialNo = serialNo;
              activePassage.lastAssignedPageNo = page.pageNo;

              if (
                activePassage.sectionEnd !== undefined &&
                serialNo >= activePassage.sectionEnd
              ) {
                activePassage.isClosed = true;
              }
            }
          }
        } else {
          // Non-comprehension question (e.g. Maths, Physics, Chemistry, Grammar)
          // If comprehension questions were already assigned to activePassage,
          // encountering a non-comprehension item signals that comprehension has ended.
          if (activePassage && activePassage.questionsAssignedCount > 0) {
            activePassage.isClosed = true;
          }
        }

        if (!existing) {
          // Initialize fresh record for this serialNo
          const optionsMap: Partial<Record<"A" | "B" | "C" | "D", string>> = {};
          if (item.options) {
            for (const key of OPTION_KEYS) {
              if (
                item.options[key] !== undefined &&
                item.options[key] !== null
              ) {
                optionsMap[key] = cleanOptionText(item.options[key]!);
              }
            }
          }

          const svgOptionsMap: Partial<Record<"A" | "B" | "C" | "D", string>> =
            {};
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
            passageContent: itemPassageContent,
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
                const cleanedOpt = cleanOptionText(optText);
                if (existing.optionIncomplete && existing.optionsMap[key]) {
                  existing.optionsMap[key] =
                    `${existing.optionsMap[key]} ${cleanedOpt}`.trim();
                } else if (!existing.optionsMap[key]) {
                  existing.optionsMap[key] = cleanedOpt;
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

          // Assign Passage if existing does not have one and this item has one
          if (!existing.passageContent && itemPassageContent) {
            existing.passageContent = itemPassageContent;
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

      // Clean question text
      let finalQuestionText = cleanQuestionText(
        record.questionText,
        record.serialNo,
      );
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
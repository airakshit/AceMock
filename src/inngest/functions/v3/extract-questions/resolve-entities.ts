/**
 * V3 ENTITY RESOLUTION ("stitcher") — turns per-page super-schema parses
 * into a flat list of resolved questions plus leftovers for LLM resolution.
 *
 * Identity is the printed PATH chain. Everything here is PURE: no DB, no
 * LLM, no network — fully unit-testable.
 *
 * Coverage map (each rule is a deliberate scenario):
 *  1. Plain question                          -> own ResolvedQuestion
 *  2. Parent stem + sub-questions             -> stem prefixed into children
 *  3. Sub-question with no printed text       -> inherits the stem verbatim
 *  4. Figure-only sub-question                -> question = stem, figure kept
 *  5. Content printed together in one entity  -> merged into one record
 *  6. Continuation fragment (no path, page    -> appended to the open
 *     opens mid-entity)                          entity from the last page
 *  7. Re-printed label after a split          -> same record (merged)
 *  8. Suffix-only printed paths               -> ancestors inherited from the
 *                                                numbering context (structural)
 *  9. Answer-key rows                         -> matched to questions exact,
 *                                                else unique-question fallback
 * 10. Unlabeled answer row                    -> matched to the single open
 *                                                candidate, else unresolved
 * 11. Passage chains across pages             -> bound to following
 *                                                comprehension questions
 * 12. Section restarts                        -> section-scoped identity,
 *                                                numbering context reset
 * 13. Duplicate ids / ambiguous paths         -> flagged, never fabricated
 * 14. Orphan fragments / unmatched answers    -> UnresolvedEntity for the
 *                                                LLM resolver
 */
import type { QuestionOption } from "@/features/questions/types";
import type { BoundingBox, OcrPageResult } from "../ocr-page/types";
import type {
  SuperEntity,
  StructuredPageParseResult,
  SuperPageSection,
} from "../ocr-page/super-schema";
import {
  inheritPath,
  formatPathDisplay,
  pathKey,
  segmentsFromKey,
} from "../ocr-page/path-utils";
import type {
  ResolvedQuestion,
  StitchResult,
  UnresolvedEntity,
} from "./types";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;
type OptionKey = (typeof OPTION_KEYS)[number];

// ---------------------------------------------------------------------------
// Internal accumulators
// ---------------------------------------------------------------------------

interface QuestionRecord {
  key: string;
  /** Resolved path (may include inherited ancestor labels). */
  path: string[];
  /** True when some ancestor labels were inherited rather than printed. */
  derivedPath: boolean;
  fileId: string;
  pageNos: number[];
  ownText: string[];
  solutionText: string[];
  options: Partial<Record<OptionKey, { text?: string }>>;
  questionFigures: BoundingBox[];
  solutionFigures: BoundingBox[];
  optionFigures: Partial<Record<OptionKey, BoundingBox>>;
  hasOptions: boolean;
  answerKey?: string;
  /** Standalone printed answer value carried by the solution block — also the final worked value used for option cross-check. */
  solutionAnswerValue?: string | number;
  subject?: string;
  marks?: number;
  difficulty?: string;
  /** True when this block can stand alone without parent stem or other pages. */
  isStandalone?: boolean;
  /** Still expecting a continuation on the next page. */
  open: boolean;
  /** Sequence of reasons why resolution was not fully confident. */
  ambiguous: string[];
}

interface PassageChain {
  contentChunks: string[];
  isOpen: boolean;
  startPageNo: number;
  fileId: string;
}

interface AnswerRow {
  path?: string[];
  fileId: string;
  pageNo: number;
  answerKey?: string;
  answerValue?: string | number;
}

interface PassageHeuristics {
  containsSTEMIndicators(text: string): boolean;
  hasPassageQuestionKeywords(text: string): boolean;
}

interface BuildInput {
  pages: Array<
    Omit<OcrPageResult, "extractedFigures" | "error"> & {
      parsedData?: StructuredPageParseResult;
    }
  >;
  /** Passage-binding knobs (injectable for tests). */
  heuristics?: PassageHeuristics;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function joinText(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAnswerRowEntity(entity: SuperEntity): boolean {
  return (
    !entity.passage &&
    !entity.question &&
    !entity.options &&
    (entity.answerKey !== undefined ||
      entity.solution?.answerValue !== undefined)
  );
}

function isVisibleEntity(entity: SuperEntity): boolean {
  return !!(
    entity.passage ||
    entity.question ||
    entity.solution ||
    entity.options ||
    entity.answerKey !== undefined
  );
}

function defaultContainsSTEMIndicators(text?: string | null): boolean {
  if (!text) return false;
  return /\$|\\frac|\\sqrt|\\int|\\sum|\\ce\{|\\times|\\approx|\\pm|\\alpha|\\beta|\\theta|\b(dx|dy|dt)\b/i.test(
    text,
  );
}

function defaultHasPassageQuestionKeywords(text?: string | null): boolean {
  if (!text) return false;
  return /\b(according to the passage|in the passage|author('s)? view|author implies|passage suggests|passage mentions|based on the passage|central theme of the passage|tone of the passage)\b/i.test(
    text,
  );
}

function sectionSignature(sections?: SuperPageSection[]): string {
  return sections?.map((s) => s.label).join("||") ?? "";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function resolveEntities(input: BuildInput): StitchResult {
  const heuristics: PassageHeuristics = input.heuristics ?? {
    containsSTEMIndicators: defaultContainsSTEMIndicators,
    hasPassageQuestionKeywords: defaultHasPassageQuestionKeywords,
  };

  const records = new Map<string, QuestionRecord>();
  const order: string[] = [];
  const passages: PassageChain[] = [];
  const answerRows: AnswerRow[] = [];
  const unresolved: UnresolvedEntity[] = [];
  const warnings: string[] = [];
  let unresolvedSeq = 0;

  const pages = [...input.pages].sort((a, b) => {
    const an = a.pageNo ?? Infinity;
    const bn = b.pageNo ?? Infinity;
    return an - bn;
  });

  // Stitch state carried across pages:
  let lastOpenKey: string | null = null;
  let numberingContext: string[] = [];
  let activeSectionLabel: string | undefined;
  let activeSectionSignature = "";
  let sectionEachMarks: number | undefined;

  for (const page of pages) {
    if (
      page.status !== "completed" ||
      page.isRelevant === false ||
      !page.parsedData
    ) {
      if (page.isRelevant !== false && page.status === "completed") {
        warnings.push(
          `Page ${page.pageNo}: completed but has no parsed data; skipped.`,
        );
      }
      continue;
    }

    const parsed = page.parsedData;
    const entities = parsed.entities ?? [];
    sectionEachMarks = parsed.sections?.[0]?.eachMarks;

    // -- Section tracking -------------------------------------------------
    const signature = sectionSignature(parsed.sections);
    if (signature !== activeSectionSignature) {
      if (
        activeSectionSignature !== "" &&
        parsed.isStartOpen &&
        numberingContext.length > 0
      ) {
        warnings.push(
          `Page ${page.pageNo}: section changed while a continuation was open; path inheritance may be ambiguous.`,
        );
      }
      activeSectionSignature = signature;
      activeSectionLabel = parsed.sections?.[0]?.label;
      if (!parsed.isStartOpen) {
        // Section restart usually resets printed numbering.
        numberingContext = [];
      }
    }

    // -- Entities ---------------------------------------------------------
    const pageRecordKeys: string[] = [];
    const firstVisibleIndex = entities.findIndex(isVisibleEntity);

    entities.forEach((entity, index) => {
      if (!isVisibleEntity(entity)) return;
      const isFirst = index === firstVisibleIndex;

      if (entity.passage) {
        handlePassage(page, entity, isFirst);
        return;
      }
      if (isAnswerRowEntity(entity)) {
        handleAnswerRow(page, entity);
        return;
      }
      if (entity.question || entity.solution || entity.options) {
        handleQuestionEntity(page, entity, isFirst, pageRecordKeys);
      }
    });

    // -- Page boundary state ----------------------------------------------
    if (parsed.isEndOpen) {
      const lastKey = pageRecordKeys[pageRecordKeys.length - 1] ?? null;
      lastOpenKey = lastKey && records.get(lastKey)?.open ? lastKey : null;
    } else {
      for (const record of records.values()) record.open = false;
      lastOpenKey = null;
      if (parsed.entities?.length) {
        const lastRecord = records.get(
          pageRecordKeys[pageRecordKeys.length - 1] ?? "",
        );
        if (lastRecord && !lastRecord.derivedPath) {
          numberingContext = lastRecord.path;
        } else if (lastRecord?.path.length) {
          numberingContext = lastRecord.path;
        }
      }
    }
  }

  // =========================================================================
  // PHASE 2 — stems, answer rows, passages, ResolvedQuestion construction
  // =========================================================================

  const recordList = order.map((key) => records.get(key)!);

  // 2a. Direct-children map (for stem-only detection): for every record,
  //     find records whose parent path equals this record's full path.
  const childKeysOf = new Map<string, string[]>();
  for (const parent of recordList) {
    const parentPathKey = pathKey(parent.path);
    const children = recordList
      .filter(
        (r) =>
          r !== parent &&
          pathKey(r.path.slice(0, -1)) === parentPathKey,
      )
      .map((r) => r.key);
    if (children.length > 0) {
      childKeysOf.set(parent.key, children);
    }
  }

  const questions: ResolvedQuestion[] = [];

  for (const record of recordList) {
    const childKeys = childKeysOf.get(record.key) ?? [];
    const isStemOnly =
      !record.hasOptions &&
      record.answerKey === undefined &&
      record.solutionAnswerValue === undefined &&
      childKeys.length > 0;

    if (isStemOnly) {
      // Pure directive/stem: content lives inside its children.
      continue;
    }

    const stem = stemSegmentsFor(record.path);
    const ownText = joinText(record.ownText);
    // Only join the parent stem when this record is NOT standalone.
    const questionParts = record.isStandalone ? [] : [...stem.textParts];
    if (ownText) questionParts.push(ownText);
    const questionText = joinText(questionParts);

    const options: QuestionOption[] = OPTION_KEYS.filter(
      (key) => record.options[key] !== undefined,
    ).map((key) => ({
      key,
      text: record.options[key]?.text ?? "",
    }));

    // Cross-check: if the solution's final answer value matches an option
    // text, that option is the correct one (physics/math worked answers).
    const finalValue = record.solutionAnswerValue !== undefined
      ? String(record.solutionAnswerValue).trim()
      : null;
    const crossCheckOption = finalValue !== null
      ? options.find((opt) => opt.text.trim() === finalValue)?.key
      : undefined;

    const usable =
      questionText.trim().length > 0 ||
      record.questionFigures.length > 0 ||
      options.length > 0;

    if (!usable) {
      pushUnresolvedRecord(record, [
        `no-usable-content:${record.ambiguous.join(";") || "empty text"}`,
      ]);
      continue;
    }

    const needsReview = record.ambiguous.length > 0;

    const resolved: ResolvedQuestion = {
      fileId: record.fileId,
      pageNos: [...record.pageNos],
      path: record.path,
      label: formatPathDisplay(record.path),
      pathKey: pathKey(record.path),
      question: questionText,
      isStandalone: record.isStandalone ?? false,
      options,
      correctOption: record.answerKey ?? crossCheckOption ?? options[0]?.key ?? "A",
      marks:
        record.marks ??
        stem.marks ??
        sectionEachMarks ??
        1,
      difficulty:
        (record.difficulty as ResolvedQuestion["difficulty"]) ??
        (stem.difficulty as ResolvedQuestion["difficulty"]) ??
        "medium",
      subject: record.subject ?? stem.subject,
      questionFigures: record.questionFigures.length
        ? record.questionFigures
        : undefined,
      solutionFigures: record.solutionFigures.length
        ? record.solutionFigures
        : undefined,
      optionFigures: Object.keys(record.optionFigures).length
        ? record.optionFigures
        : undefined,
      hint: null,
      solution: record.solutionText.length
        ? joinText(record.solutionText)
        : null,
      answerValue:
        record.solutionAnswerValue !== undefined
          ? String(record.solutionAnswerValue)
          : null,
      needsReview,
      reviewReasons: needsReview ? [...record.ambiguous] : undefined,
    };

    questions.push(resolved);
  }

  // 2a-fix: stem-only records that are NOT questions — do not emit.

  // 2c. Answer rows -> match to questions.
  for (const row of answerRows) {
    const match = matchAnswerRow(row, questions);
    if (match) {
      if (row.answerKey !== undefined) match.correctOption = row.answerKey;
      if (row.answerValue !== undefined) {
        match.answerValue = String(row.answerValue);
      }
    } else {
      pushUnresolvedAnswerRow(row);
    }
  }

  // 2d. Passage binding.
  if (passages.length > 0) {
    bindPassages(questions, heuristics, warnings);
  }

  return { questions, unresolved, warnings };

  // =========================================================================
  // PHASE 1 handlers (closures over the stitch state)
  // =========================================================================

  function handlePassage(
    page: BuildInput["pages"][number],
    entity: SuperEntity,
    isFirst: boolean,
  ) {
    const parsed = page.parsedData!;
    const passage = entity.passage!;
    const previous = passages[passages.length - 1];
    const continues =
      parsed.isStartOpen && isFirst && previous && previous.isOpen;

    if (continues && previous) {
      previous.contentChunks.push(passage.text);
      previous.isOpen = parsed.isEndOpen;
      return;
    }

    passages.push({
      contentChunks: [passage.text],
      isOpen: parsed.isEndOpen,
      startPageNo: page.pageNo,
      fileId: page.fileId,
    });
  }

  function handleAnswerRow(
    page: BuildInput["pages"][number],
    entity: SuperEntity,
  ) {
    // Same structural rule as question entities: a short printed chain
    // (e.g. just "ii") gets ancestor reconstruction; complete chains pass
    // through untouched.
    let path: string[] | undefined = entity.path;

    if (path) {
      const extended = resolveIncompletePath(path);
      if (extended && extended.length > path.length) path = extended;
      // Unresolvable suffix -> keep printed; matcher handles by leaf later
    }

    answerRows.push({
      path: path && path.length ? path : undefined,
      fileId: page.fileId,
      pageNo: page.pageNo,
      answerKey: entity.answerKey,
      answerValue: entity.solution?.answerValue,
    });
  }

  function handleQuestionEntity(
    page: BuildInput["pages"][number],
    entity: SuperEntity,
    isFirst: boolean,
    pageRecordKeys: string[],
  ) {
    const parsed = page.parsedData!;

    // Scenario 6: unlabeled fragment while a record is still open.
    if (
      (!entity.path || entity.path.length === 0) &&
      isFirst &&
      lastOpenKey &&
      records.has(lastOpenKey)
    ) {
      appendIntoRecord(lastOpenKey, entity, page);
      return;
    }
    if (!entity.path || entity.path.length === 0) {
      pushUnresolvedRawEntity(entity, page, ["unlabeled-fragment"]);
      return;
    }

    // Inheritance is STRUCTURAL now (no explicit flag): when the printed
    // chain is plausibly a suffix of the in-progress hierarchy, the full
    // chain is reconstructed from context. Only extensions that genuinely
    // ADD ancestor levels count as derived (=> needsReview); verbatim
    // complete paths pass through untouched.
    let resolvedPath: string[] = entity.path;
    let derived = false;
    const extended = resolveIncompletePath(entity.path);
    if (extended && extended.length > resolvedPath.length) {
      resolvedPath = extended;
      derived = true;
    }

    const key = scopedKey(resolvedPath);
    const existing = records.get(key);

    if (existing) {
      // Scenario 5/7: content printed together or label re-printed after a
      // page split — merge into the same record. A re-used path on
      // genuinely different content is suspicious; flag it.
      const isContinuation =
        parsed.isStartOpen &&
        isFirst &&
        (lastOpenKey === key || lastOpenKey === null) &&
        existing.open;
      if (!isContinuation) {
        existing.ambiguous.push(
          `duplicate-path:${formatPathDisplay(resolvedPath)} merged on page ${page.pageNo}`,
        );
      }
      appendIntoRecord(key, entity, page);
      if (!pageRecordKeys.includes(key)) pageRecordKeys.push(key);
      return;
    }

    // New record.
    const record: QuestionRecord = {
      key,
      path: resolvedPath,
      derivedPath: derived,
      fileId: page.fileId,
      pageNos: [page.pageNo],
      ownText: entity.question?.text ? [entity.question.text] : [],
      solutionText: entity.solution?.text ? [entity.solution.text] : [],
      options: {},
      questionFigures: entity.question?.figures
        ? [...entity.question.figures]
        : [],
      solutionFigures: entity.solution?.figures
        ? [...entity.solution.figures]
        : [],
      optionFigures: {},
      hasOptions: !!entity.options,
      answerKey: entity.answerKey,
      solutionAnswerValue: entity.solution?.answerValue,
      subject: entity.question?.subject,
      marks: entity.question?.marks,
      difficulty: entity.question?.difficulty,
      isStandalone: entity.question?.isStandalone,
      open: parsed.isEndOpen,
      ambiguous: derived
        ? [`path-inherited:ancestors from page ${page.pageNo}`]
        : [],
    };

    if (entity.options) {
      for (const optionKey of OPTION_KEYS) {
        const option = entity.options[optionKey];
        if (!option) continue;
        record.options[optionKey] = { text: option.text ?? undefined };
        if (entity.options[optionKey]?.figure) {
          record.optionFigures[optionKey] = entity.options[optionKey]!.figure;
        }
      }
    }

    records.set(key, record);
    order.push(key);
    pageRecordKeys.push(key);
  }

  function appendIntoRecord(
    key: string,
    entity: SuperEntity,
    page: BuildInput["pages"][number],
  ) {
    const record = records.get(key);
    const parsed = page.parsedData!;
    if (!record) {
      pushUnresolvedRawEntity(entity, page, ["open-record-missing"]);
      return;
    }

    if (!record.pageNos.includes(page.pageNo)) record.pageNos.push(page.pageNo);

    if (entity.question?.text) {
      record.ownText.push(entity.question.text);
    }
    if (entity.question?.figures?.length) {
      record.questionFigures.push(...entity.question.figures);
    }
    if (entity.solution?.text) {
      record.solutionText.push(entity.solution.text);
    }
    if (entity.solution?.figures?.length) {
      record.solutionFigures.push(...entity.solution.figures);
    }
    if (entity.options) {
      for (const optionKey of OPTION_KEYS) {
        const option = entity.options[optionKey];
        if (!option) continue;
        const existing = record.options[optionKey];
        record.options[optionKey] = {
          text:
            option.text !== undefined
              ? existing?.text
                ? `${existing.text} ${option.text}`.trim()
                : option.text
              : existing?.text,
        };
        const figure = entity.options[optionKey]?.figure;
        if (figure && !record.optionFigures[optionKey]) {
          record.optionFigures[optionKey] = figure;
        }
      }
      record.hasOptions = true;
    }
    if (entity.answerKey !== undefined && record.answerKey === undefined) {
      record.answerKey = entity.answerKey;
    }
    const solutionAnswerValue = entity.solution?.answerValue;
    if (
      solutionAnswerValue !== undefined &&
      record.solutionAnswerValue === undefined
    ) {
      record.solutionAnswerValue = solutionAnswerValue;
    }
    if (entity.question?.marks !== undefined && record.marks === undefined) {
      record.marks = entity.question.marks;
    }
    if (entity.question?.subject && !record.subject) {
      record.subject = entity.question.subject;
    }
    if (entity.question?.difficulty && !record.difficulty) {
      record.difficulty = entity.question.difficulty;
    }

    // A page that ends complete closes the record; a page that ends open
    // keeps it open for the next page.
    if (parsed.isEndOpen) {
      record.open = true;
    } else {
      record.open = false;
    }
  }

  function resolveIncompletePath(
    visibleSuffix: string[],
  ): string[] | null {
    const candidates: string[][] = [numberingContext];
    if (lastOpenKey) {
      const lastRecord = records.get(lastOpenKey);
      if (lastRecord) candidates.push(lastRecord.path);
    }
    for (const base of candidates) {
      if (!base.length) continue;
      const extended = inheritPath(base, visibleSuffix);
      if (extended) return extended;
    }
    return null;
  }

  function scopedKey(path: string[]): string {
    return `${activeSectionLabel ?? ""}|${pathKey(path)}`;
  }

  /** Ancestor stem text/subject/marks/difficulty walking path ancestors. */
  function stemSegmentsFor(path: string[]): {
    textParts: string[];
    subject?: string;
    marks?: number;
    difficulty?: string;
  } {
    const textParts: string[] = [];
    let subject: string | undefined;
    let marks: number | undefined;
    let difficulty: string | undefined;

    const segments = segmentsFromKey(pathKey(path));
    for (let depth = 1; depth < segments.length; depth++) {
      const ancestor = records.get(
        scopedKey(path.slice(0, depth)),
      );
      if (!ancestor) continue;
      const text = joinText(ancestor.ownText);
      if (text) textParts.push(text);
      subject ??= ancestor.subject;
      marks ??= ancestor.marks;
      difficulty ??= ancestor.difficulty;
    }
    return { textParts, subject, marks, difficulty };
  }

  function pushUnresolvedRecord(record: QuestionRecord, reasons: string[]) {
    unresolvedSeq += 1;
    warnings.push(
      `Unresolved record ${record.key}: ${reasons.join("; ")}`,
    );
    unresolved.push({
      id: `unresolved-${unresolvedSeq}`,
      fileId: record.fileId,
      pageNo: record.pageNos[0] ?? 0,
      entity: {
        path: record.path,
        question:
          record.ownText.length || record.questionFigures.length
            ? {
                text: joinText(record.ownText),
                figures: record.questionFigures,
                isStandalone: false,
              }
            : undefined,
        solution:
          record.solutionText.length || record.solutionFigures.length
            ? {
                text: joinText(record.solutionText),
                figures: record.solutionFigures,
                answerValue:
                  record.solutionAnswerValue !== undefined
                    ? String(record.solutionAnswerValue)
                    : undefined,
              }
            : undefined,
        options: record.hasOptions
          ? {
              A: { text: record.options.A?.text },
              B: { text: record.options.B?.text },
              C: { text: record.options.C?.text },
              D: { text: record.options.D?.text },
            }
          : undefined,
        answerKey: record.answerKey as SuperEntity["answerKey"],
      },
      reasons,
    });
  }

  function pushUnresolvedRawEntity(
    entity: SuperEntity,
    page: BuildInput["pages"][number],
    reasons: string[],
  ) {
    unresolvedSeq += 1;
    unresolved.push({
      id: `unresolved-${unresolvedSeq}`,
      fileId: page.fileId,
      pageNo: page.pageNo,
      entity,
      reasons,
    });
  }

  function pushUnresolvedAnswerRow(row: AnswerRow) {
    unresolvedSeq += 1;
    unresolved.push({
      id: `unresolved-${unresolvedSeq}`,
      fileId: row.fileId,
      pageNo: row.pageNo,
      entity: {
        path: row.path,
        answerKey: row.answerKey as SuperEntity["answerKey"],
        solution: row.answerValue !== undefined
          ? {
              text: undefined,
              figures: [],
              answerValue: row.answerValue,
            }
          : undefined,
      },
      reasons: ["unmatched-answer-row"],
    });
  }

  function matchAnswerRow(
    row: AnswerRow,
    resolvedQuestions: ResolvedQuestion[],
  ): ResolvedQuestion | null {
    if (row.path && row.path.length > 0) {
      const key = pathKey(row.path);
      const sameFile = resolvedQuestions.filter(
        (q) => q.pathKey === key && q.fileId === row.fileId,
      );
      if (sameFile.length === 1) return sameFile[0];
      if (sameFile.length > 1) {
        // Same path in the same file is ambiguous — but narrow by page
        // proximity when possible.
        const pageMatch = sameFile.filter((q) =>
          q.pageNos.includes(row.pageNo),
        );
        if (pageMatch.length === 1) return pageMatch[0];
        warnings.push(
          `Answer row path ${formatPathDisplay(row.path)} matched ${sameFile.length} question records; left unresolved.`,
        );
        return null;
      }
      const crossFile = resolvedQuestions.filter((q) => q.pathKey === key);
      return crossFile.length === 1 ? crossFile[0] : null;
    }

    // Unlabeled answer row: bind only when exactly one candidate question
    // on this page still lacks an answer key AND an answer value.
    const candidates = resolvedQuestions.filter(
      (q) =>
        q.fileId === row.fileId &&
        q.pageNos.includes(row.pageNo) &&
        q.answerValue == null,
    );
    return candidates.length === 1 ? candidates[0] : null;
  }

  function bindPassages(
    resolvedQuestions: ResolvedQuestion[],
    h: PassageHeuristics,
    warns: string[],
  ): void {
    for (let i = 0; i < passages.length; i++) {
      const chain = passages[i];
      const content = joinText(chain.contentChunks);
      if (!content) continue;
      const nextStart = i + 1 < passages.length ? passages[i + 1].startPageNo : Infinity;

      const candidates = resolvedQuestions.filter((q) => {
        const firstPage = Math.min(...q.pageNos);
        return (
          q.fileId === chain.fileId &&
          firstPage >= chain.startPageNo &&
          firstPage < nextStart
        );
      });

      if (candidates.length === 0) {
        warns.push(
          `Passage chain starting page ${chain.startPageNo} bound to no questions.`,
        );
        continue;
      }

      for (const q of candidates) {
        const subjectLower = (q.subject ?? "").toLowerCase();
        const isNonComprehensionSubject =
          subjectLower === "math" ||
          subjectLower === "physics" ||
          subjectLower === "chemistry";
        const likelyComprehension =
          subjectLower === "comprehension" ||
          (!isNonComprehensionSubject &&
            !h.containsSTEMIndicators(q.question) &&
            h.hasPassageQuestionKeywords(q.question));

        if (likelyComprehension) {
          q.passageContent = content;
        }
      }
    }
  }
}

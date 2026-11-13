/**
 * V3 ENTITY RESOLUTION ("stitcher") â€” NEW ALGORITHM.
 *
 * Turns per-page super-schema parses into a flat list of resolved questions
 * plus leftovers for LLM resolution. Everything here is PURE: no DB, no LLM,
 * no network â€” fully unit-testable.
 *
 * The pipeline is COLLECT â†’ CLUSTER â†’ RECONCILE â†’ EMIT:
 *
 *   PHASE A â€” COLLECT. Walk pages one whole file at a time (file order =
 *   insertion order; pageNo restarts per file, so a global pageNo sort would
 *   interleave a question paper with its solutions paper). Each visible
 *   entity becomes a typed BLOCK with a resolved path â€” no merge decisions
 *   are made. Page-boundary FRAGMENTS (startState/endState) attach to the
 *   item they continue: the previous page's endState pairs positionally
 *   with the next page's startState, and a printed refPath anchors a
 *   fragment to its own path. Nothing else is committed.
 *
 *   PHASE B â€” CLUSTER. Blocks group into ITEMS by
 *   `fileId :: sectionLabel :: pathKey`. Within an item, content merges in
 *   arrival order; a re-used path carrying NEW question text outside a
 *   continuation is flagged `duplicate-path`, never fabricated away.
 *
 *   RECONCILE. With every page seen, items that refer to the same printed
 *   question are folded together â€” decidable only now:
 *     1. A content-less (solution/answer-only) item folds into the question
 *        item with the same pathKey (same file preferred, cross-file next).
 *        Several candidates â†’ LLM resolver, never a silent drop.
 *     2. A LONE CHILD item (no siblings at its parent level) whose unique
 *        parent item exists folds into it when it is a mangled re-print â€”
 *        solutions papers annotate re-prints as "70(c)" (= question 70,
 *        answer c), which the model reads as a child path. Real
 *        sub-questions have siblings and survive.
 *     3. Two question items with the same pathKey merge only when their
 *        stems re-print each other (word overlap); dissimilar stems are
 *        genuinely different questions (multi-section / multi-set papers)
 *        and stay separate.
 *
 *   PHASE C â€” EMIT. The path tree (per section) supplies parent stems,
 *   marks/subject inheritance and sibling context. Answer-key rows amend
 *   their question's correct option; passages bind to following
 *   comprehension questions. Readiness (`is_ready` / `not_ready_reason`)
 *   comes from ./readiness.
 */
import type { QuestionOption } from "@/features/questions/types";
import type { BoundingBox, OcrPageResult } from "../ocr-page/types";
import type { ExtractedFigure } from "../ocr-page/extract-figures";
import {
  START_FRAGMENT_SLOT,
} from "../ocr-page/path-utils";
import type {
  SuperEntity,
  StructuredPageParseResult,
} from "../ocr-page/super-schema";
import {
  canonicalizeSegment,
  inheritPath,
  formatPathDisplay,
  labelKind,
  labelValue,
  pathKey,
  segmentsFromKey,
} from "../ocr-page/path-utils";
import type {
  ResolvedQuestion,
  StandaloneRewriteJob,
  StitchResult,
  UnresolvedEntity,
} from "./types";
import {
  buildFailureReasons,
  deriveFigureFailureReason,
  deriveReadiness,
  type ReadinessReason,
} from "./readiness";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;
type OptionKey = (typeof OPTION_KEYS)[number];

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Section metadata carried across pages while it stays active. */
interface ActiveSection {
  label: string;
  startPath?: string[];
  /** When set, the section's range ends after this question path. */
  endPath?: string[];
  eachMarks?: number;
}

/** Injectable passage-binding heuristics (tests). */
interface PassageHeuristics {
  containsSTEMIndicators(text: string): boolean;
  hasPassageQuestionKeywords(text: string): boolean;
}

export interface BuildInput {
  pages: Array<
    Omit<OcrPageResult, "extractedFigures" | "error"> & {
      parsedData?: StructuredPageParseResult;
    }
  >;
  heuristics?: PassageHeuristics;
  /**
   * Page crops keyed by pathKey (optional). The crops of PATHLESS boundary
   * fragments arrive keyed under the synthetic "@start"/"@end" slots; once
   * fragments are merged into items with real paths, those crops are
   * re-bound in place to the paired item's path.
   */
  figures?: ExtractedFigure[];
}

/**
 * One collected question-content entity with its resolved identity. Pure
 * data â€” no merge decisions have been made yet.
 */
interface ContentBlock {
  seq: number;
  fileId: string;
  pageNo: number;
  /** Cluster identity: fileId :: sectionLabel :: canonical pathKey. */
  clusterId: string;
  /** Section-scoped record key (recordKey / rewrite-job id lineage). */
  scopedKey: string;
  path: string[];
  pathKey: string;
  /** Some ancestor labels were inherited rather than printed. */
  derivedPath: boolean;
  /** Continuation of the previously open item (same cluster guaranteed). */
  isContinuation: boolean;
  sectionLabel: string;
  sectionEachMarks?: number;
  entity: SuperEntity;
}

/** A bare answer-key row: printed key/value with no solution narrative. */
interface AnswerKeyRow {
  seq: number;
  fileId: string;
  pageNo: number;
  path?: string[];
  pathKey?: string;
  answerKey?: string;
  answerValue?: string | number;
}

interface PassageChain {
  contentChunks: string[];
  isOpen: boolean;
  startPageNo: number;
  fileId: string;
}

/**
 * One printed question â€” all blocks of a cluster merged. Identity decisions
 * (folds, dedup) happen on items, never on raw blocks.
 */
interface Item {
  /** Unique cluster key â€” also recordKey / rewrite-job id lineage. */
  key: string;
  seq: number;
  fileId: string;
  pageNos: number[];
  path: string[];
  pathKey: string;
  sectionLabel: string;
  sectionEachMarks?: number;

  ownText: string[];
  questionFigures: BoundingBox[];
  options: Partial<Record<OptionKey, { text?: string }>>;
  optionFigures: Partial<Record<OptionKey, BoundingBox>>;
  hasOptions: boolean;

  solutionText: string[];
  solutionFigures: BoundingBox[];
  answerKey?: string;
  /** Standalone printed answer value carried by the solution block. */
  solutionAnswerValue?: string | number;

  subject?: string;
  /** Marks printed on the QUESTION block (or inherited via subparts). */
  marks?: number;
  /** Marks printed on the SOLUTION block â€” top priority. */
  solutionMarks?: number;
  isStandalone?: boolean;

  figureResolved: boolean;
  figureNotFound: boolean;
  /** Sequence of reasons why resolution was not fully confident. */
  ambiguous: string[];
}

/**
 * PATH TREE â€” every surviving item is attached under its section root by
 * its canonical path chain; parent/child/sibling relations come from this
 * single structure. Ancestor labels never printed as entities become
 * PHANTOM nodes (`item` null).
 */
interface PathNode {
  key: string;
  section: string;
  segments: string[];
  item: Item | null;
  parent: PathNode | null;
  children: Map<string, PathNode>;
}

/** Mutable readiness bookkeeping for one resolved question. */
interface ReadinessState {
  reasons: ReadinessReason[];
  hadAnswerKey: boolean;
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

/**
 * One `[[FIG:<path>]]` annotation token per figure â€” the placeholder the
 * standalone rewriter sees instead of actual image data. Multiple figures
 * get ordinal suffixes: `[[FIG:4(ii)]]`, `[[FIG:4(ii):2]]`.
 */
function figureTokens(display: string, count: number): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) =>
    count > 1 ? `[[FIG:${display}:${index + 1}]]` : `[[FIG:${display}]]`,
  );
}

/**
 * A bare answer-key TABLE row: only a printed key/value with no solution
 * narrative. An entity that ALSO carries solution text or figures is a
 * solution block (typical "Solutions" section entries printed with their
 * answer key) â€” it must go through the content-block path. Routing it here
 * would DROP the solution text, because answer rows only carry key/value.
 */
function isAnswerRowEntity(entity: SuperEntity): boolean {
  return (
    !entity.passage &&
    !entity.question &&
    !entity.options &&
    !entity.solution?.text?.trim() &&
    !(entity.solution?.figures && entity.solution.figures.length > 0) &&
    (entity.answerKey !== undefined ||
      entity.solution?.answerValue !== undefined)
  );
}

/** Appends a bounding box unless the exact same box is already listed. */
function pushUniqueBox(list: BoundingBox[], box: BoundingBox): void {
  if (
    list.some(
      (existing) =>
        existing.xMin === box.xMin &&
        existing.yMin === box.yMin &&
        existing.xMax === box.xMax &&
        existing.yMax === box.yMax,
    )
  ) {
    return;
  }
  list.push(box);
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

/** This entity starts NEW question content (vs only options/solution). */
function contributesNewQuestion(entity: SuperEntity): boolean {
  return !!entity.question?.text?.trim();
}

/** Solution-side content an item or block carries. */
function carriesSolution(item: {
  solutionText: string[];
  solutionFigures: BoundingBox[];
}): boolean {
  return item.solutionText.length > 0 || item.solutionFigures.length > 0;
}

function hasQuestionContent(item: Item): boolean {
  return (
    item.ownText.length > 0 ||
    item.questionFigures.length > 0 ||
    Object.keys(item.options).length > 0
  );
}

/**
 * Rough re-print check: do the two texts cover (mostly) the same words? A
 * solutions-paper re-print restates the printed stem almost verbatim, while
 * a genuine sub-question's text ("(ii) The past tense of go isâ€¦") shares
 * almost nothing with its instruction-style stem ("Answer any two").
 */
function isReprintOf(candidate: string, printed: string): boolean {
  const wordSetOf = (text: string) =>
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1),
    );
  const candidateWords = wordSetOf(candidate);
  const printedWords = wordSetOf(printed);
  if (!candidateWords.size || !printedWords.size) return false;
  const [small, large] =
    candidateWords.size <= printedWords.size
      ? [candidateWords, printedWords]
      : [printedWords, candidateWords];
  let shared = 0;
  for (const word of small) if (large.has(word)) shared += 1;
  return shared / small.size >= 0.7;
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function resolveEntities(input: BuildInput): StitchResult {
  const heuristics: PassageHeuristics = input.heuristics ?? {
    containsSTEMIndicators: defaultContainsSTEMIndicators,
    hasPassageQuestionKeywords: defaultHasPassageQuestionKeywords,
  };

  const unresolved: UnresolvedEntity[] = [];
  const warnings: string[] = [];
  let unresolvedSeq = 0;

  const nextUnresolvedId = () => `unresolved-${++unresolvedSeq}`;

  // =========================================================================
  // PHASE A â€” COLLECT
  // =========================================================================

  // Page order: files are processed ONE WHOLE FILE AT A TIME, pages sorted
  // within each file. pageNo restarts per file (question paper pages 1..N,
  // solutions paper pages 1..M), so a global pageNo sort would interleave
  // the two streams and leak one file's active section label into the
  // other's pages. Insertion order of first appearance defines file order
  // (func passes files in document order).
  const fileOrder: string[] = [];
  const pagesByFile = new Map<string, BuildInput["pages"][number][]>();
  for (const page of input.pages) {
    let list = pagesByFile.get(page.fileId);
    if (!list) {
      list = [];
      pagesByFile.set(page.fileId, list);
      fileOrder.push(page.fileId);
    }
    list.push(page);
  }
  const pages = fileOrder.flatMap((fileId) =>
    (pagesByFile.get(fileId) ?? []).sort(
      (a, b) => (a.pageNo ?? Infinity) - (b.pageNo ?? Infinity),
    ),
  );

  const blocks: ContentBlock[] = [];
  const answerRows: AnswerKeyRow[] = [];
  const passages: PassageChain[] = [];
  /**
   * Crops of PATHLESS boundary fragments arrive keyed under the synthetic
   * "@start"/"@end" slots. When such a fragment binds to an item, its
   * page's slot-keyed crops are re-bound to the item's real path.
   */
  const figureRebinds: Array<{
    syntheticKey: string;
    fileId: string;
    pageNo: number;
    targetPathKey: string;
  }> = [];

  // Walk state carried across pages.
  let activeSection: ActiveSection | null = null;
  let numberingContext: string[] = [];
  /** The item the last processed page left open (its endState), if any. */
  let openItem: { clusterId: string; path: string[] } | null = null;
  let seq = 0;
  /** Per-page scratch: cluster id / path of the last content block. */
  let lastBlockClusterId: string | null = null;
  let lastBlockPath: string[] | null = null;

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
    const startState = parsed.startState;
    const endState = parsed.endState;
    const startsOpen = startState.obj != null;
    // Alias that defeats TS narrowing: openItem is reassigned at the page
    // boundary below, and closures above read it across iterations.
    const openRecord = openItem as { clusterId: string; path: string[] } | null;

    // -- Section tracking ---------------------------------------------------
    // continuesPathFromPrevious declares "these questions continue the range
    // of the PREVIOUS section (across pages)" â€” the active section survives.
    // Any other section starts fresh: numbering restarts unless the page
    // itself opened mid-item.
    for (const section of parsed.sections ?? []) {
      if (section.continuesPathFromPrevious === true) {
        if (activeSection) {
          if (section.eachMarks !== undefined) {
            activeSection.eachMarks = section.eachMarks;
          }
          if (section.endPath !== undefined) {
            activeSection.endPath = section.endPath;
          }
        } else {
          warnings.push(
            `Page ${page.pageNo}: section ${section.label} declares continuesPathFromPrevious but no prior section is active; treating it as a new section.`,
          );
          activeSection = { ...section };
        }
        continue;
      }

      if (activeSection && startsOpen && numberingContext.length > 0) {
        warnings.push(
          `Page ${page.pageNo}: section ${section.label} started while a continuation was open; path inheritance may be ambiguous.`,
        );
      }
      activeSection = { ...section };
      if (!startsOpen) {
        // A fresh section restarts printed numbering (1.a, 1.b from scratch).
        numberingContext = [];
      }
    }

    const entities = parsed.entities ?? [];
    lastBlockClusterId = null;
    lastBlockPath = null;

    const collectContent = (
      entity: SuperEntity,
      resolvedPath: string[],
      derived: boolean,
      isContinuation: boolean,
      clusterIdOverride?: string,
    ) => {
      // Close the active section once the walk advances past its end path
      // (same label kind, greater value) â€” later questions no longer inherit
      // the section's eachMarks.
      expireSectionForPath(resolvedPath);

      const pathKey_ = pathKey(resolvedPath);
      const sectionLabel = activeSection?.label ?? "";
      const clusterId =
        clusterIdOverride ?? `${page.fileId}::${sectionLabel}::${pathKey_}`;

      blocks.push({
        seq: seq++,
        fileId: page.fileId,
        pageNo: page.pageNo,
        clusterId,
        scopedKey: `${sectionLabel}|${pathKey_}`,
        path: resolvedPath,
        pathKey: pathKey_,
        derivedPath: derived,
        isContinuation,
        sectionLabel,
        sectionEachMarks: activeSection?.eachMarks,
        entity,
      });
      lastBlockClusterId = clusterId;
      lastBlockPath = resolvedPath;
    };

    const collectAnswerRow = (
      entity: SuperEntity,
      printedPath: string[] | null | undefined,
    ) => {
      let rowPath: string[] | undefined = printedPath ?? undefined;
      if (rowPath) {
        const extended = resolveIncompletePath(rowPath);
        if (extended && extended.length > rowPath.length) {
          rowPath = extended;
        }
      }
      answerRows.push({
        seq: seq++,
        fileId: page.fileId,
        pageNo: page.pageNo,
        path: rowPath && rowPath.length ? rowPath : undefined,
        pathKey: rowPath && rowPath.length ? pathKey(rowPath) : undefined,
        answerKey: entity.answerKey,
        answerValue: entity.solution?.answerValue,
      });
    };

    // ---- 1. startState: page TOP ------------------------------------------
    // Either continuation text (refPath null + obj fragment) continuing the
    // item the previous page left open, or a path reference (refPath set +
    // obj null) to the first labelled entity printed on this page â€” which is
    // already present in `entities`, so nothing further to do here.
    const startFragment = startState.obj;
    if (startFragment) {
      const fragmentEntity = startFragment as SuperEntity;
      if (fragmentEntity.passage) {
        // Passage continuation across a page break: the fragment channel is
        // the only sanctioned way a passage continues, so append to the most
        // recent passage chain (or start one when the anchor is missing).
        const previous = passages[passages.length - 1];
        if (previous) {
          previous.contentChunks.push(fragmentEntity.passage.text);
        } else {
          passages.push({
            contentChunks: [fragmentEntity.passage.text],
            isOpen: false,
            startPageNo: page.pageNo,
            fileId: page.fileId,
          });
        }
      } else if (isAnswerRowEntity(fragmentEntity)) {
        collectAnswerRow(fragmentEntity, startState.refPath);
      } else if (
        fragmentEntity.question ||
        fragmentEntity.solution ||
        fragmentEntity.options
      ) {
        // Positional pairing with the item the previous page left open.
        // refPath is always null alongside obj (the fragment's label is not
        // re-printed at the top), so the open item is the only anchor.
        if (!openRecord) {
          pushUnresolvedRawEntity(fragmentEntity, page, ["unlabeled-fragment"]);
        } else {
          collectContent(
            fragmentEntity,
            openRecord.path,
            false,
            true,
            openRecord.clusterId,
          );
          // Pathless fragment: its crops sit under the "@start" slot.
          figureRebinds.push({
            syntheticKey: pathKey([START_FRAGMENT_SLOT]),
            fileId: page.fileId,
            pageNo: page.pageNo,
            targetPathKey: pathKey(openRecord.path),
          });
        }
      }
    }

    // ---- 2. Full entities printed on this page ----------------------------
    entities.forEach((entity) => {
      if (!isVisibleEntity(entity)) return;

      // -- Passages ---------------------------------------------------------
      if (entity.passage) {
        // A passage entity always starts a fresh chain: passage continuation
        // across page breaks travels through startState fragments, not
        // entities.
        passages.push({
          contentChunks: [entity.passage.text],
          isOpen: false,
          startPageNo: page.pageNo,
          fileId: page.fileId,
        });
        return;
      }

      // -- Bare answer-key rows ---------------------------------------------
      if (isAnswerRowEntity(entity)) {
        collectAnswerRow(entity, entity.path);
        return;
      }

      // -- Question content ---------------------------------------------------
      if (!(entity.question || entity.solution || entity.options)) return;

      // Degraded: a PATHLESS entity. The sanctioned pathless channel is
      // startState/endState; when the model ignores it, a pathless entity
      // belongs to the item the previous page left open, otherwise it is
      // an orphan fragment.
      if (!entity.path || entity.path.length === 0) {
        if (openRecord) {
          collectContent(entity, openRecord.path, false, true, openRecord.clusterId);
          return;
        }
        pushUnresolvedRawEntity(entity, page, ["unlabeled-fragment"]);
        return;
      }

      // Inheritance is STRUCTURAL: when the printed chain is plausibly a
      // suffix of the in-progress hierarchy, the full chain is reconstructed.
      // Only extensions that genuinely ADD ancestor levels count as derived.
      let resolvedPath: string[] = entity.path;
      let derived = false;
      const extended = resolveIncompletePath(entity.path);
      if (extended && extended.length > resolvedPath.length) {
        resolvedPath = extended;
        derived = true;
      }

      // Re-printed continuation: an entity whose path matches the item the
      // previous page left open is that item's continuation (graceful
      // degradation when the model reports boundary content as an entity).
      if (openRecord && pathKey(resolvedPath) === pathKey(openRecord.path)) {
        collectContent(entity, resolvedPath, derived, true);
        return;
      }

      collectContent(entity, resolvedPath, derived, false);
    });

    // ---- 3. Page boundary bookkeeping -------------------------------------
    // endState is a pure pointer: the printed path of the page's last entity
    // (never null in the contract; null only on noise/empty pages). It carries
    // no content â€” the bottom entity's content, complete or cut mid-way, is
    // already in `entities` under its printed path. The next page's startState
    // decides whether that item is actually continued.
    if (lastBlockPath) {
      openItem = {
        clusterId: lastBlockClusterId!,
        path: lastBlockPath,
      };
      numberingContext = lastBlockPath;
    } else if (endState.refPath?.length) {
      openItem = {
        clusterId: `${page.fileId}::${activeSection?.label ?? ""}::${pathKey(
          endState.refPath,
        )}`,
        path: endState.refPath,
      };
    } else {
      openItem = null;
    }
  }

  // =========================================================================
  // PHASE B â€” CLUSTER blocks into items
  // =========================================================================

  const itemsByClusterId = new Map<string, Item>();
  const items: Item[] = [];

  function itemFromBlock(block: ContentBlock): Item {
    const entity = block.entity;
    const item: Item = {
      key: block.clusterId,
      seq: block.seq,
      fileId: block.fileId,
      pageNos: [block.pageNo],
      path: [...block.path],
      pathKey: block.pathKey,
      sectionLabel: block.sectionLabel,
      sectionEachMarks: block.sectionEachMarks,
      ownText: entity.question?.text ? [entity.question.text] : [],
      questionFigures: entity.question?.figures
        ? [...entity.question.figures]
        : [],
      options: {},
      optionFigures: {},
      hasOptions: !!entity.options,
      solutionText: entity.solution?.text ? [entity.solution.text] : [],
      solutionFigures: entity.solution?.figures
        ? [...entity.solution.figures]
        : [],
      answerKey: entity.answerKey,
      solutionAnswerValue: entity.solution?.answerValue,
      subject: entity.question?.subject,
      marks: entity.question?.marks,
      solutionMarks: entity.solution?.marks,
      isStandalone: entity.question?.isStandalone,
      figureResolved: entity.figureResolved !== false,
      figureNotFound: entity.figureNotFound === true,
      ambiguous: block.derivedPath
        ? [`path-inherited:ancestors from page ${block.pageNo}`]
        : [],
    };
    if (entity.options) {
      for (const optionKey of OPTION_KEYS) {
        const option = entity.options[optionKey];
        if (!option) continue;
        item.options[optionKey] = { text: option.text ?? undefined };
        if (option.figure) {
          item.optionFigures[optionKey] = option.figure;
        }
      }
    }
    itemsByClusterId.set(item.key, item);
    items.push(item);
    return item;
  }

  /** Appends one block's content into its item (arrival order). */
  function appendBlock(item: Item, block: ContentBlock): void {
    const entity = block.entity;
    if (!item.pageNos.includes(block.pageNo)) item.pageNos.push(block.pageNo);

    if (entity.question?.text) item.ownText.push(entity.question.text);
    if (entity.question?.figures?.length) {
      for (const box of entity.question.figures) pushUniqueBox(item.questionFigures, box);
    }
    if (entity.solution?.text) item.solutionText.push(entity.solution.text);
    if (entity.solution?.figures?.length) {
      for (const box of entity.solution.figures) pushUniqueBox(item.solutionFigures, box);
    }
    if (entity.options) {
      for (const optionKey of OPTION_KEYS) {
        const option = entity.options[optionKey];
        if (!option) continue;
        const existing = item.options[optionKey];
        item.options[optionKey] = {
          text:
            option.text !== undefined
              ? existing?.text
                ? `${existing.text} ${option.text}`.trim()
                : option.text
              : existing?.text,
        };
        if (option.figure && !item.optionFigures[optionKey]) {
          item.optionFigures[optionKey] = option.figure;
        }
      }
      item.hasOptions = true;
    }
    if (entity.answerKey !== undefined && item.answerKey === undefined) {
      item.answerKey = entity.answerKey;
    }
    if (
      entity.solution?.answerValue !== undefined &&
      item.solutionAnswerValue === undefined
    ) {
      item.solutionAnswerValue = entity.solution.answerValue;
    }
    if (entity.question?.marks !== undefined && item.marks === undefined) {
      item.marks = entity.question.marks;
    }
    if (
      entity.solution?.marks !== undefined &&
      item.solutionMarks === undefined
    ) {
      item.solutionMarks = entity.solution.marks;
    }
    if (entity.question?.subject && !item.subject) {
      item.subject = entity.question.subject;
    }
    if (
      item.isStandalone === undefined &&
      entity.question?.isStandalone !== undefined
    ) {
      item.isStandalone = entity.question.isStandalone;
    }
    // The strongest (false) evidence wins for figure resolution.
    if (entity.figureResolved === false) item.figureResolved = false;
    if (entity.figureNotFound === true) item.figureNotFound = true;
  }

  for (const block of blocks) {
    const existing = itemsByClusterId.get(block.clusterId);
    if (!existing) {
      itemFromBlock(block);
      continue;
    }
    // Re-used path with genuinely NEW question text outside a continuation
    // is suspicious â€” flag it, never fabricate. Solution/options-only
    // re-prints are legitimate attachments (Solutions section).
    if (
      contributesNewQuestion(block.entity) &&
      !block.isContinuation &&
      existing.ownText.length > 0
    ) {
      existing.ambiguous.push(
        `duplicate-path:${formatPathDisplay(block.path)} merged on page ${block.pageNo}`,
      );
    }
    appendBlock(existing, block);
  }

  // =========================================================================
  // RECONCILE â€” fold items that refer to the same printed question.
  // Decidable only now that every page has been seen.
  // =========================================================================

  /**
   * Folds `source` into `target`. Everything `source` carried is
   * transferred; the target's identity (path, fileId, section, stem) wins.
   */
  function foldItem(target: Item, source: Item, reason?: string): void {
    if (reason) target.ambiguous.push(reason);
    if (!target.ownText.length && source.ownText.length) {
      target.ownText.push(...source.ownText);
    }
    if (!target.questionFigures.length && source.questionFigures.length) {
      for (const box of source.questionFigures) {
        pushUniqueBox(target.questionFigures, box);
      }
    }
    if (target.isStandalone === undefined && source.isStandalone !== undefined) {
      target.isStandalone = source.isStandalone;
    }
    if (source.solutionText.length) {
      target.solutionText.push(...source.solutionText);
    }
    if (source.solutionFigures.length) {
      for (const box of source.solutionFigures) {
        pushUniqueBox(target.solutionFigures, box);
      }
    }
    for (const optionKey of OPTION_KEYS) {
      const sourceOption = source.options[optionKey];
      if (!sourceOption) continue;
      const existing = target.options[optionKey];
      target.options[optionKey] = {
        text: existing?.text
          ? `${existing.text} ${sourceOption.text ?? ""}`.trim()
          : sourceOption.text,
      };
      if (!target.optionFigures[optionKey] && source.optionFigures[optionKey]) {
        target.optionFigures[optionKey] = source.optionFigures[optionKey]!;
      }
    }
    if (source.hasOptions) target.hasOptions = true;
    if (target.answerKey === undefined && source.answerKey !== undefined) {
      target.answerKey = source.answerKey;
    }
    if (
      target.solutionAnswerValue === undefined &&
      source.solutionAnswerValue !== undefined
    ) {
      target.solutionAnswerValue = source.solutionAnswerValue;
    }
    if (target.marks === undefined && source.marks !== undefined) {
      target.marks = source.marks;
    }
    if (target.solutionMarks === undefined && source.solutionMarks !== undefined) {
      target.solutionMarks = source.solutionMarks;
    }
    if (!target.subject && source.subject) {
      target.subject = source.subject;
    }
    // Strongest (false/true) evidence wins â€” same rule as block appends.
    if (source.figureResolved === false) target.figureResolved = false;
    if (source.figureNotFound === true) target.figureNotFound = true;
    for (const pageNo of source.pageNos) {
      if (!target.pageNos.includes(pageNo)) target.pageNos.push(pageNo);
    }
    removeItem(source);
  }

  function removeItem(item: Item): void {
    itemsByClusterId.delete(item.key);
    const idx = items.indexOf(item);
    if (idx !== -1) items.splice(idx, 1);
  }

  // ---- 1. Content-less items fold into the question item with the same
  //         pathKey (same file preferred, cross-file next).
  for (const item of [...items]) {
    if (hasQuestionContent(item) || !item.path.length) continue;
    const sameFile = items.filter(
      (r) => r !== item && hasQuestionContent(r) && r.pathKey === item.pathKey,
    );
    const sameFileInOwnFile = sameFile.filter((r) => r.fileId === item.fileId);
    const candidates =
      sameFileInOwnFile.length > 0 ? sameFileInOwnFile : sameFile;
    if (candidates.length === 1) {
      foldItem(candidates[0], item);
    } else if (candidates.length > 1) {
      // Multi-section paper: the printed path exists under several sections.
      // Hand the block to the LLM resolver with a visible reason instead of
      // silently dropping its content.
      warnings.push(
        `Record ${item.key}: ${formatPathDisplay(item.path)} matches ${candidates.length} question records; the solution/answer block is left for the LLM resolver.`,
      );
      pushUnresolvedItem(item, [
        `ambiguous-attachment:${formatPathDisplay(item.path)} matches ${candidates.length} question records`,
      ]);
      removeItem(item);
    }
    // Zero candidates â€” the question was never extracted; the item survives
    // and lands in the resolver via the usable check at emission.
  }

  // ---- 2. Lone-child items fold into their unique parent item when they
  //         are mangled re-prints ("70(c)" read as ["70","c"]).
  const parentKeyOf = (item: Item) => pathKey(item.path.slice(0, -1));

  for (const item of [...items]) {
    if (item.path.length < 2) continue;
    const parentKey = parentKeyOf(item);
    if (!parentKey || parentKey === "[]") continue;
    // A real sub-question always has siblings at its own level.
    const hasSiblings = items.some(
      (r) => r !== item && parentKeyOf(r) === parentKey,
    );
    if (hasSiblings) continue;
    const parents = items.filter(
      (r) => r !== item && hasQuestionContent(r) && r.pathKey === parentKey,
    );
    if (parents.length !== 1) continue;
    const parent = parents[0];
    const crossFileSolution =
      parent.fileId !== item.fileId && carriesSolution(item);
    const textMatches =
      item.ownText.length > 0 &&
      parent.ownText.length > 0 &&
      isReprintOf(joinText(item.ownText), joinText(parent.ownText));
    if (!crossFileSolution && !textMatches) continue;
    foldItem(parent, item);
  }

  // ---- 3. Question items with the same pathKey merge only when their
  //         stems re-print each other; dissimilar stems (multi-section /
  //         multi-set papers) are genuinely different questions.
  for (const item of [...items]) {
    if (!hasQuestionContent(item)) continue;
    const others = items.filter(
      (r) => r !== item && hasQuestionContent(r) && r.pathKey === item.pathKey,
    );
    if (others.length === 0) continue;
    const itemText = joinText(item.ownText);
    if (!itemText) continue;
    for (const other of others) {
      const otherText = joinText(other.ownText);
      if (!otherText || !isReprintOf(itemText, otherText)) continue;
      // The item with printed options is the question paper's â€” it wins.
      const [target, source] =
        other.hasOptions && !item.hasOptions ? [other, item] : [item, other];
      foldItem(target, source);
      break;
    }
  }

  // =========================================================================
  // PHASE C â€” EMIT: path tree, stems, readiness, answer rows, passages
  // =========================================================================

  // ---- Path tree ----------------------------------------------------------
  const sectionRoots = new Map<string, PathNode>();
  const nodesByClusterKey = new Map<string, PathNode>();

  function rootForSection(section: string): PathNode {
    let root = sectionRoots.get(section);
    if (!root) {
      root = {
        key: `root:${section}`,
        section,
        segments: [],
        item: null,
        parent: null,
        children: new Map(),
      };
      sectionRoots.set(section, root);
    }
    return root;
  }

  function ensureNode(section: string, segments: string[]): PathNode {
    let node = rootForSection(section);
    for (let depth = 1; depth <= segments.length; depth++) {
      const partial = segments.slice(0, depth);
      const nodeKey = `${section}|${pathKey(partial)}`;
      let next = nodesByClusterKey.get(nodeKey);
      if (!next) {
        next = {
          key: nodeKey,
          section,
          segments: partial,
          item: null,
          parent: node,
          children: new Map(),
        };
        nodesByClusterKey.set(nodeKey, next);
        node.children.set(partial[partial.length - 1], next);
      }
      node = next;
    }
    return node;
  }

  for (const item of items) {
    ensureNode(item.sectionLabel, segmentsFromKey(item.pathKey)).item = item;
  }

  // Document-ordered direct children per parent node.
  const orderedChildren = new Map<string, string[]>();
  for (const item of [...items].sort((a, b) => a.seq - b.seq)) {
    const parent = nodeForItem(item)?.parent;
    if (!parent) continue;
    const list = orderedChildren.get(parent.key);
    if (list) list.push(item.key);
    else orderedChildren.set(parent.key, [item.key]);
  }

  /** The path-tree node an item is attached under (section-scoped). */
  function nodeForItem(item: Item): PathNode | null {
    return (
      nodesByClusterKey.get(`${item.sectionLabel}|${item.pathKey}`) ?? null
    );
  }

  /** Ancestor stem text/subject/marks + figure annotations (top-down). */
  function stemFor(item: Item): {
    textParts: string[];
    subject?: string;
    marks?: number;
    figureAnnotations: string[];
  } {
    const textParts: string[] = [];
    let subject: string | undefined;
    let marks: number | undefined;
    const figureAnnotations: string[] = [];

    const node = nodeForItem(item);
    const chain: Item[] = [];
    let cursor = node?.parent ?? null;
    while (cursor) {
      if (cursor.item) chain.push(cursor.item);
      cursor = cursor.parent;
    }
    chain.reverse();

    for (const ancestor of chain) {
      const text = joinText(ancestor.ownText);
      if (text) textParts.push(text);
      subject ??= ancestor.subject;
      marks ??= ancestor.marks;
      if (ancestor.questionFigures.length > 0) {
        figureAnnotations.push(
          ...figureTokens(
            formatPathDisplay(ancestor.path),
            ancestor.questionFigures.length,
          ),
        );
      }
    }
    return { textParts, subject, marks, figureAnnotations };
  }

  /** Previous and next sibling records in document order (rewrite context). */
  function siblingContextFor(item: Item): StandaloneRewriteJob["surrounding"] {
    const parent = nodeForItem(item)?.parent;
    if (!parent) return [];
    const siblings = orderedChildren.get(parent.key) ?? [];
    const index = siblings.indexOf(item.key);
    if (index === -1) return [];

    const context: StandaloneRewriteJob["surrounding"] = [];
    for (const offset of [-1, 1] as const) {
      const sibling = itemsByClusterId.get(siblings[index + offset] ?? "");
      if (!sibling) continue;
      context.push({
        label: formatPathDisplay(sibling.path),
        question: joinText(sibling.ownText),
        solution: sibling.solutionText.length
          ? joinText(sibling.solutionText)
          : undefined,
      });
    }
    return context;
  }

  const questions: ResolvedQuestion[] = [];
  const readinessStates = new Map<ResolvedQuestion, ReadinessState>();
  const standaloneRewrites: StandaloneRewriteJob[] = [];

  for (const item of [...items].sort((a, b) => a.seq - b.seq)) {
    const node = nodeForItem(item);
    const stem = stemFor(item);

    // Pure directive/stem records (children carry the actual subquestions)
    // are not questions themselves â€” their text is joined into children.
    const isStemOnly =
      !item.hasOptions &&
      item.answerKey === undefined &&
      item.solutionAnswerValue === undefined &&
      (node?.children.size ?? 0) > 0;
    if (isStemOnly) continue;

    const ownText = joinText(item.ownText);
    // Only join the parent stem when this record is NOT standalone.
    const standalone = item.isStandalone ?? false;
    const questionParts = standalone ? [] : [...stem.textParts];
    if (ownText) questionParts.push(ownText);
    const questionText = joinText(questionParts);

    const options: QuestionOption[] = OPTION_KEYS.filter(
      (key) => item.options[key] !== undefined,
    ).map((key) => ({
      key,
      text: item.options[key]?.text ?? "",
    }));

    // Cross-check: if the solution's final answer value matches an option
    // text, that option is the correct one (physics/math worked answers).
    const finalValue =
      item.solutionAnswerValue !== undefined
        ? String(item.solutionAnswerValue).trim()
        : null;
    const crossCheckOption =
      finalValue !== null
        ? options.find((opt) => opt.text.trim() === finalValue)?.key
        : undefined;

    const joinedSolution =
      item.solutionText.length > 0 ? joinText(item.solutionText) : null;

    const usable =
      questionText.trim().length > 0 ||
      item.questionFigures.length > 0 ||
      options.length > 0;
    if (!usable) {
      pushUnresolvedItem(item, [
        `no-usable-content:${item.ambiguous.join(";") || "empty text"}`,
      ]);
      continue;
    }

    const needsReview = item.ambiguous.length > 0;

    const initialReadiness = deriveReadiness({
      question: questionText,
      questionFigureCount: item.questionFigures.length,
      hasOptions: item.hasOptions || item.answerKey !== undefined,
      optionCount: options.length,
      solution: joinedSolution,
      answerKey: item.answerKey ?? null,
      answerValue:
        item.solutionAnswerValue !== undefined
          ? String(item.solutionAnswerValue)
          : null,
    });

    const resolved: ResolvedQuestion = {
      fileId: item.fileId,
      pageNos: [...item.pageNos],
      path: item.path,
      label: formatPathDisplay(item.path),
      pathKey: item.pathKey,
      recordKey: item.key,
      question: questionText,
      isStandalone: standalone,
      options,
      correctOption:
        item.answerKey ?? crossCheckOption ?? options[0]?.key ?? "A",
      marks:
        item.solutionMarks ?? item.marks ?? stem.marks ?? item.sectionEachMarks ?? 1,
      subject: item.subject ?? stem.subject,
      questionFigures: item.questionFigures.length
        ? item.questionFigures
        : undefined,
      solutionFigures: item.solutionFigures.length
        ? item.solutionFigures
        : undefined,
      optionFigures: Object.keys(item.optionFigures).length
        ? item.optionFigures
        : undefined,
      hint: null,
      solution: joinedSolution,
      figureResolved: item.figureResolved,
      figureNotFound: item.figureNotFound || undefined,
      failureReasons: buildFailureReasons(
        initialReadiness.reasons,
        deriveFigureFailureReason({
          figureResolved: item.figureResolved,
          figureNotFound: item.figureNotFound,
        }),
      ),
      answerValue:
        item.solutionAnswerValue !== undefined
          ? String(item.solutionAnswerValue)
          : null,
      needsReview,
      reviewReasons: needsReview ? [...item.ambiguous] : undefined,
      isReady: initialReadiness.isReady,
    };

    readinessStates.set(resolved, {
      reasons: [...initialReadiness.reasons],
      hadAnswerKey: item.answerKey !== undefined,
    });

    questions.push(resolved);

    // Fragment (non-standalone) questions queue for the LLM standalone
    // rewrite pass â€” deterministic fallback text stays in place if it fails.
    if (!standalone) {
      const display = formatPathDisplay(item.path);
      standaloneRewrites.push({
        id: item.key,
        pathKey: resolved.pathKey,
        fileId: item.fileId,
        pageNo: item.pageNos[0] ?? 0,
        ownQuestionText: ownText,
        ownSolutionText: item.solutionText.length
          ? joinText(item.solutionText)
          : undefined,
        parentStem: stem.textParts.length ? joinText(stem.textParts) : undefined,
        figureAnnotations: [
          ...figureTokens(display, item.questionFigures.length),
          ...figureTokens(display, item.solutionFigures.length),
          ...stem.figureAnnotations,
        ],
        surrounding: siblingContextFor(item),
        fallbackQuestion: questionText,
        fallbackSolution: joinedSolution ?? undefined,
      });
    }
  }

  // ---- Answer-key rows â†’ match to questions. A matched key/value removes
  //      that question's "missing answer key" readiness reason.
  for (const row of answerRows) {
    const match = matchAnswerRow(row, questions);
    if (match) {
      if (row.answerKey !== undefined) match.correctOption = row.answerKey;
      if (row.answerValue !== undefined) {
        match.answerValue = String(row.answerValue);
      }
      const state = readinessStates.get(match);
      if (state) {
        if (row.answerKey !== undefined) state.hadAnswerKey = true;
        const reasons: ReadinessReason[] = state.reasons.filter(
          (r) => r !== "missing answer key",
        );
        const hasAnswerValue =
          match.answerValue != null && match.answerValue.trim().length > 0;
        if (!state.hadAnswerKey && !hasAnswerValue) {
          reasons.push("missing answer key");
        }
        state.reasons = reasons;
        match.isReady = reasons.length === 0;
        // Keep the persisted not_ready_reason array in lock-step with the
        // amended readiness codes (the figure reason never changes here).
        match.failureReasons = buildFailureReasons(
          reasons,
          deriveFigureFailureReason({
            figureResolved: match.figureResolved,
            figureNotFound: match.figureNotFound,
          }),
        );
      }
    } else {
      pushUnresolvedAnswerRow(row);
    }
  }

  // ---- Passage binding.
  if (passages.length > 0) {
    bindPassages(questions, heuristics);
  }

  // ---- Re-bind the crops of PATHLESS boundary fragments: they arrived
  //      keyed under the synthetic "@start"/"@end" slots; now that their
  //      fragments are merged into items with real paths, rewrite the crop
  //      keys in place so figure mapping can attach them to the questions.
  if (input.figures && figureRebinds.length > 0) {
    for (const rebind of figureRebinds) {
      for (const fig of input.figures) {
        if (
          fig.pathKey === rebind.syntheticKey &&
          fig.fileId === rebind.fileId &&
          fig.pageNo === rebind.pageNo
        ) {
          fig.pathKey = rebind.targetPathKey;
          fig.path = segmentsFromKey(rebind.targetPathKey);
        }
      }
    }
  }

  return { questions, unresolved, standaloneRewrites, warnings };

  // =========================================================================
  // Walk-time helpers (closures over stitch state)
  // =========================================================================

  /** Structural suffix resolution from the in-progress numbering context. */
  function resolveIncompletePath(visibleSuffix: string[]): string[] | null {
    const candidates: Array<string[] | null | undefined> = [
      numberingContext,
      openItem?.path,
    ];
    for (const base of candidates) {
      if (!base || !base.length) continue;
      const extended = inheritPath(base, visibleSuffix);
      if (extended) return extended;
    }
    return null;
  }

  /**
   * Closes the active section once a question's path advances past the
   * section's printed endPath (same label kind, greater value).
   */
  function expireSectionForPath(path: string[]): void {
    const section = activeSection;
    if (!section?.startPath?.length || !section.endPath?.length) return;
    const top = canonicalizeSegment(path[0] ?? "");
    const endTop = canonicalizeSegment(section.endPath[0]);
    if (!top || top === endTop) return;
    if (labelKind(top) !== labelKind(endTop)) return;
    const valueA = labelValue(top);
    const valueB = labelValue(endTop);
    if (valueA !== null && valueB !== null && valueA > valueB) {
      activeSection = null;
    }
  }

  // =========================================================================
  // Unresolved / diagnostics helpers
  // =========================================================================

  function pushUnresolvedRawEntity(
    entity: SuperEntity,
    page: BuildInput["pages"][number],
    reasons: string[],
  ) {
    unresolved.push({
      id: nextUnresolvedId(),
      fileId: page.fileId,
      pageNo: page.pageNo,
      entity,
      reasons,
    });
  }

  /** Reconstitutes the entity an item collected and hands it to the resolver. */
  function pushUnresolvedItem(item: Item, reasons: string[]) {
    warnings.push(`Unresolved record ${item.key}: ${reasons.join("; ")}`);
    unresolved.push({
      id: nextUnresolvedId(),
      fileId: item.fileId,
      pageNo: item.pageNos[0] ?? 0,
      entity: {
        path: item.path,
        question:
          item.ownText.length || item.questionFigures.length
            ? {
                text: joinText(item.ownText),
                figures: item.questionFigures,
                isStandalone: false,
              }
            : undefined,
        solution:
          item.solutionText.length || item.solutionFigures.length
            ? {
                text: joinText(item.solutionText),
                figures: item.solutionFigures,
                answerValue:
                  item.solutionAnswerValue !== undefined
                    ? String(item.solutionAnswerValue)
                    : undefined,
              }
            : undefined,
        options: item.hasOptions
          ? {
              A: { text: item.options.A?.text },
              B: { text: item.options.B?.text },
              C: { text: item.options.C?.text },
              D: { text: item.options.D?.text },
            }
          : undefined,
        answerKey: item.answerKey as SuperEntity["answerKey"],
      },
      reasons,
    });
  }

  function pushUnresolvedAnswerRow(row: AnswerKeyRow) {
    unresolved.push({
      id: nextUnresolvedId(),
      fileId: row.fileId,
      pageNo: row.pageNo,
      entity: {
        path: row.path,
        answerKey: row.answerKey as SuperEntity["answerKey"],
        solution:
          row.answerValue !== undefined
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
    row: AnswerKeyRow,
    resolvedQuestions: ResolvedQuestion[],
  ): ResolvedQuestion | null {
    if (row.path && row.path.length > 0) {
      const key = pathKey(row.path);
      const sameFile = resolvedQuestions.filter(
        (q) => q.pathKey === key && q.fileId === row.fileId,
      );
      if (sameFile.length === 1) return sameFile[0];
      if (sameFile.length > 1) {
        // Same path in the same file is ambiguous â€” but narrow by page
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
  ): void {
    for (let i = 0; i < passages.length; i++) {
      const chain = passages[i];
      const content = joinText(chain.contentChunks);
      if (!content) continue;
      const nextStart =
        i + 1 < passages.length ? passages[i + 1].startPageNo : Infinity;

      const candidates = resolvedQuestions.filter((q) => {
        const firstPage = Math.min(...q.pageNos);
        return (
          q.fileId === chain.fileId &&
          firstPage >= chain.startPageNo &&
          firstPage < nextStart
        );
      });

      if (candidates.length === 0) {
        warnings.push(
          `Passage chain starting page ${chain.startPageNo} bound to no questions.`,
        );
        continue;
      }

      for (const q of candidates) {
        const subjectLower = (q.subject ?? "").toLowerCase();
        const isNonComprehensionSubject =
          subjectLower === "maths" ||
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

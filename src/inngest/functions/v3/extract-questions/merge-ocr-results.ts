/**
 * V3 merge orchestrator.
 *
 * The heavy lifting lives in ./resolve-entities (pure). This module keeps
 * the historical entry point (`mergeOcrResults`) and adds defensive
 * normalization of incoming page results.
 *
 * `figures` (optional) are the page crops keyed by pathKey. The stitcher
 * re-binds the crops of PATHLESS boundary fragments (keyed under the
 * synthetic "@start"/"@end" slots) to the paired item's real path — the
 * binding is only known after fragments are merged into their items.
 */
import type { OcrPageResult } from "../ocr-page/types";
import type { StructuredPageParseResult } from "../ocr-page/super-schema";
import { EMPTY_PAGE_STATE } from "../ocr-page/super-schema";
import type { ExtractedFigure } from "../ocr-page/extract-figures";
import { resolveEntities } from "./resolve-entities";
import type { StitchResult } from "./types";

/**
 * Merges per-page OCR results into resolved questions + unresolved entities.
 * Raises no errors for stitching ambiguity — ambiguity is surfaced as
 * `unresolved` entries and logged warnings so the LLM resolver can salvage
 * them; structural failures (schema mismatches) are already non-retriable
 * errors raised upstream during the page OCR stage.
 */
export function mergeOcrResults(
  pages: OcrPageResult[],
  figures?: ExtractedFigure[],
): StitchResult {
  const normalized = pages.map((page) => ({
    pageNo: page.pageNo,
    pageId: page.pageId,
    fileId: page.fileId,
    rawText: page.rawText,
    status: page.status,
    survivedValidation: page.survivedValidation,
    isRelevant: page.isRelevant,
    startState: page.startState ?? EMPTY_PAGE_STATE,
    endState: page.endState ?? EMPTY_PAGE_STATE,
    parsedData: page.parsedData as StructuredPageParseResult | undefined,
  }));

  return resolveEntities({ pages: normalized, figures });
}

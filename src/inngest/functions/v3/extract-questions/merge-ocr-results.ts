/**
 * V3 merge orchestrator.
 *
 * The heavy lifting lives in ./resolve-entities (pure). This module keeps
 * the historical entry point (`mergeOcrResults`) and adds defensive
 * normalization of incoming page results.
 */
import type { OcrPageResult } from "../ocr-page/types";
import type { StructuredPageParseResult } from "../ocr-page/super-schema";
import { resolveEntities } from "./resolve-entities";
import type { StitchResult } from "./types";

/**
 * Merges per-page OCR results into resolved questions + unresolved entities.
 * Raises no errors for stitching ambiguity — ambiguity is surfaced as
 * `unresolved` entries and logged warnings so the LLM resolver can salvage
 * them; structural failures (schema mismatches) are already non-retriable
 * errors raised upstream during the page OCR stage.
 */
export function mergeOcrResults(pages: OcrPageResult[]): StitchResult {
  const normalized = pages.map((page) => ({
    pageNo: page.pageNo,
    pageId: page.pageId,
    fileId: page.fileId,
    rawText: page.rawText,
    status: page.status,
    survivedValidation: page.survivedValidation,
    isRelevant: page.isRelevant,
    isStartOpen: page.isStartOpen ?? false,
    isEndOpen: page.isEndOpen ?? false,
    parsedData: page.parsedData as StructuredPageParseResult | undefined,
  }));

  return resolveEntities({ pages: normalized });
}

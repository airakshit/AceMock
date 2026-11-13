import {
  BoundingBox,
  EMPTY_PAGE_STATE,
  StructuredPageParseResult,
} from "./super-schema";
import type { ExtractedFigure } from "./extract-figures";

export type { ExtractedFigure } from "./extract-figures";
export { EMPTY_PAGE_STATE };

/**
 * Loosely-typed page-boundary state carried at the OcrPageResult top level.
 * The authoritative, fully-typed states live in `parsedData` (super-schema
 * after the stage-1/stage-2 merge; partial-schemas before it) — this loose
 * shape exists so both variants can ride along on best-effort parses.
 */
export interface LoosePageState {
  refPath: string[] | null;
  /** Present on startState (may be null). Absent on endState (pure pointer). */
  obj?: object | null;
}

/**
 * The result of one page's OCR execution.
 * Entity identity is the PATH (see ./path-utils); the page-boundary states
 * live at the top level too, so downstream stitching survives even
 * best-effort parses.
 */
export interface OcrPageResult {
  /** 1-based page number */
  pageNo: number;

  /** DB primary key of the file_pages row */
  pageId: string;

  /** DB primary key of the parent document_files row */
  fileId: string;

  /** The raw OCR transcribed text */
  rawText: string | null;

  /** OCR execution status */
  status: "completed" | "failed";

  /** Whether the OCR output successfully conformed to the v3 schema */
  survivedValidation: boolean;

  /** Whether the page is relevant */
  isRelevant: boolean;

  /** Page TOP: the single fragment continuing the previous page's entity. */
  startState: LoosePageState;

  /** Page BOTTOM: the single fragment this page leaves open. */
  endState: LoosePageState;

  /** Parsed structured data conforming to super-schema if available */
  parsedData?: StructuredPageParseResult;

  /** Extracted figures from this page (if any) */
  extractedFigures?: ExtractedFigure[];

  /** Error message if OCR processing failed */
  error?: string | null;
}

export type { BoundingBox };

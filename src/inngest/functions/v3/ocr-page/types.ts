import { BoundingBox, StructuredPageParseResult } from "./super-schema";
import type { ExtractedFigure } from "./extract-figures";

export type { ExtractedFigure } from "./extract-figures";

/**
 * The result of one page's OCR execution.
 * Entity identity is the PATH (see ./path-utils); boundary flags live at the
 * top level too, so downstream stitching survives even best-effort parses.
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

  /** Page opens mid-entity (continuation from the previous page). */
  isStartOpen: boolean;

  /** Page ends mid-entity (content continues onto the next page). */
  isEndOpen: boolean;

  /** Parsed structured data conforming to super-schema if available */
  parsedData?: StructuredPageParseResult;

  /** Extracted figures from this page (if any) */
  extractedFigures?: ExtractedFigure[];

  /** Error message if OCR processing failed */
  error?: string | null;
}

export type { BoundingBox };

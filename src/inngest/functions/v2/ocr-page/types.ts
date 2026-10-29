import { StructuredSchemaParseResult } from "./structured-question-schema";
import { BoundingBox } from "./structured-question-schema";

/**
 * An extracted figure from the page.
 */
export interface ExtractedFigure {
  /** The serial number of the question/solution/option this figure belongs to. */
  serialNo: number;
  /** Type of figure: question stem, solution, or option. */
  figureType: "question" | "solution" | "option";
  /** For option figures, which option (A/B/C/D). */
  optionKey?: "A" | "B" | "C" | "D";
  /** Storage path where the cropped figure was saved. */
  storagePath: string;
  /** Original bounding box on the page (normalized 0-1). */
  bbox: BoundingBox;
  /** Page number the figure was extracted from. */
  pageNo: number;
}

/**
 * The output of a single page OCR execution.
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

  /** Whether the OCR text successfully conformed to structuredOCRExtractionSchema */
  survivedValidation: boolean;

  // Whether if the page is relevant or not.
  isRelevant: boolean;

  /** Parsed structured data conforming to schema if available */
  parsedData?: StructuredSchemaParseResult;

  /** Extracted figures from this page (if any) */
  extractedFigures?: ExtractedFigure[];

  /** Error message if OCR processing failed */
  error?: string | null;
}

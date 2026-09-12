import type {
  QuestionDifficulty,
  QuestionOption,
} from "@/features/questions/types";
import type { StructuredSchemaParseResult } from "./schema";

// ─────────────────────────────────────────────────────────────────────────────
// OCR Types
// ─────────────────────────────────────────────────────────────────────────────

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
  status: "success" | "failed";

  /** Whether the OCR text successfully conformed to structuredOCRExtractionSchema */
  survivedValidation: boolean;

  // Whether if the page is relevant or not.
  isRelevant: boolean;

  /** Parsed structured data conforming to schema if available */
  parsedData?: StructuredSchemaParseResult;

  /** Error message if OCR processing failed */
  error?: string | null;
}

/**
 * A resolved question entity ready for database persistence after merging
 * cross-page splits, solutions, answer keys, and continuation states.
 */
export interface ResolvedQuestion {
  serialNo: number;
  fileId: string;
  question: string;
  options: QuestionOption[];
  correctOption: string;
  marks: number;
  difficulty: QuestionDifficulty;
  subject?: string;
  hint?: string | null;
  solution?: string | null;
  diagram_url?: string | null;
  solution_diagram_url?: string | null;
  passageId?: string | null;
  passageContent?: string | null;
  svgQuestion?: string | null;
  svgSolution?: string | null;
}


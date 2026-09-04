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

  /** Error message if OCR processing failed */
  error?: string | null;
}

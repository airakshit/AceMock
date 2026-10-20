import type { ResolvedQuestion } from "../extract-questions/types";

export const EXTRACT_FIGURES_EVENT = "documents/extract-figures" as const;

/**
 * One flagged figure job: a single page image plus the serial number whose
 * figure must be pulled out of it. Keeping the job this small is what lets the
 * extraction call spend its whole output budget on one figure.
 */
export interface FigureExtractionRequest {
  pageId: string;
  fileId: string;
  fileName: string;
  pageNo: number;
  storagePath: string;
  serialNo: number;
}

/** An extracted figure pair, keyed back to the item it belongs to. */
export interface FigureExtractionResult {
  pageId: string;
  fileId: string;
  pageNo: number;
  serialNo: number;
  svgQuestion: string | null;
  svgSolution: string | null;
}

export interface ExtractFiguresEventData {
  userId: string;
  documentId: string;
  requests: FigureExtractionRequest[];
}

export interface ExtractFiguresResult {
  results: FigureExtractionResult[];
}

/** Derives a stable identity for a figure job, used for deduping requests. */
export function figureRequestKey(
  request: FigureExtractionRequest,
): string {
  return `${request.pageId}\u0000${request.serialNo}`;
}

/** True when a question carries a figure one of these SVG slots can hold. */
export function hasExtractableFigure(
  question: Pick<ResolvedQuestion, "svgQuestion" | "svgSolution">,
): boolean {
  return Boolean(question.svgQuestion?.trim() || question.svgSolution?.trim());
}

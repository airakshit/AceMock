import {
  FigureExtractionRequest,
  FigureExtractionResult,
  figureRequestKey,
} from "../extract-figures/types";
import type { ResolvedQuestion } from "./types";

/** Page facts a figure job needs, drawn from the pages OCR already covers. */
export interface FigureJobPage {
  fileId: string;
  fileName: string;
  pageId: string;
  pageNo: number;
  storagePath: string;
}

/**
 * Phase 2 only runs where phase 1 flagged a figure. Items without the flag keep
 * whatever inline markup the legacy OCR merged, so nothing is lost on documents
 * that predate the split.
 */
export function buildFigureRequests(input: {
  pages: FigureJobPage[];
  resolvedQuestions: ResolvedQuestion[];
}): FigureExtractionRequest[] {
  const pageByKey = new Map(
    input.pages.map((page) => [`${page.fileId}\u0000${page.pageNo}`, page]),
  );

  const requests: FigureExtractionRequest[] = [];

  for (const question of input.resolvedQuestions) {
    if (!question.hasFigure) continue;

    // An item's text can continue across pages, and its figure may sit on any
    // of those pages — one job per contributing page, so the focused call only
    // ever sees the page that can actually contain the drawing.
    for (const pageNo of question.pageNos) {
      const page = pageByKey.get(`${question.fileId}\u0000${pageNo}`);
      if (!page) continue;

      requests.push({ ...page, serialNo: question.serialNo });
    }
  }

  return dedupeRequests(requests);
}

function dedupeRequests(
  requests: FigureExtractionRequest[],
): FigureExtractionRequest[] {
  const byKey = new Map<string, FigureExtractionRequest>();
  for (const request of requests) {
    byKey.set(figureRequestKey(request), request);
  }
  return [...byKey.values()];
}

/**
 * Writes the figures phase 2 returned onto the resolved questions, so the same
 * merge output that persists the questions also carries their diagrams.
 *
 * A slot already holding legacy inline SVG is never overwritten, and the two
 * slots are independent: a stem figure extracted from one page and a solution
 * figure from another both land on their question.
 */
export function applyFigureResults(
  resolvedQuestions: ResolvedQuestion[],
  results: FigureExtractionResult[],
): number {
  const questionByItem = new Map(
    resolvedQuestions.map((question) => [
      `${question.fileId}\u0000${question.serialNo}`,
      question,
    ]),
  );

  let applied = 0;

  for (const result of results) {
    const question = questionByItem.get(
      `${result.fileId}\u0000${result.serialNo}`,
    );
    if (!question) continue;

    let touched = false;

    if (result.svgQuestion && !question.svgQuestion) {
      question.svgQuestion = result.svgQuestion;
      touched = true;
    }
    if (result.svgSolution && !question.svgSolution) {
      question.svgSolution = result.svgSolution;
      touched = true;
    }

    if (touched) applied += 1;
  }

  return applied;
}

import type { ExtractedFigure } from "../ocr-page/types";
import type { ResolvedQuestion } from "./types";

/**
 * Diagram storage paths resolved for a single question.
 */
export interface QuestionDiagramPaths {
  /** Storage path of the cropped question-stem diagram (first match). */
  questionDiagram: string | null;
  /** Storage path of the cropped solution diagram (first match). */
  solutionDiagram: string | null;
  /** Storage paths of per-option diagrams, keyed by option letter. */
  optionDiagrams: Partial<Record<"A" | "B" | "C" | "D", string>>;
}

/**
 * V3: maps already-extracted figures (cropped and uploaded by the ocr-page
 * stage) onto resolved questions via the canonical PATH KEY.
 *
 * Matching priority per question:
 *   1. pathKey + a page the figure was extracted from that this question
 *      actually spans (handles section-scoped path reprints),
 *   2. pathKey alone (cross-page entities).
 * Figures of unmatched pathKeys are ignored (logged upstream).
 */
export function mapExtractedFiguresToQuestions(
  resolvedQuestions: ResolvedQuestion[],
  allExtractedFigures: ExtractedFigure[],
): Map<string, QuestionDiagramPaths> {
  const result = new Map<string, QuestionDiagramPaths>();
  if (allExtractedFigures.length === 0) return result;

  const figuresByKey = new Map<string, ExtractedFigure[]>();
  for (const fig of allExtractedFigures) {
    const group = figuresByKey.get(fig.pathKey) ?? [];
    group.push(fig);
    figuresByKey.set(fig.pathKey, group);
  }

  const consumed = new Set<ExtractedFigure>();

  // Pass 1: strict match — pathKey AND page overlap.
  for (const q of resolvedQuestions) {
    if (q.pathKey.startsWith("resolved:")) continue;
    const candidates = (figuresByKey.get(q.pathKey) ?? []).filter(
      (fig) => !consumed.has(fig) && q.pageNos.includes(fig.pageNo),
    );
    if (candidates.length > 0) {
      result.set(q.pathKey, takeFigures(q, candidates, consumed));
    }
  }

  // Pass 2: pathKey-only (figures from adjacent pages of a split entity).
  for (const q of resolvedQuestions) {
    if (result.has(q.pathKey)) continue;
    const candidates = (figuresByKey.get(q.pathKey) ?? []).filter(
      (fig) => !consumed.has(fig),
    );
    if (candidates.length > 0) {
      result.set(q.pathKey, takeFigures(q, candidates, consumed));
    }
  }

  return result;
}

function takeFigures(
  _q: ResolvedQuestion,
  figures: ExtractedFigure[],
  consumed: Set<ExtractedFigure>,
): QuestionDiagramPaths {
  const paths: QuestionDiagramPaths = {
    questionDiagram: null,
    solutionDiagram: null,
    optionDiagrams: {},
  };

  for (const fig of figures) {
    consumed.add(fig);
    switch (fig.figureType) {
      case "question":
        if (!paths.questionDiagram) paths.questionDiagram = fig.storagePath;
        break;
      case "solution":
        if (!paths.solutionDiagram) paths.solutionDiagram = fig.storagePath;
        break;
      case "option":
        if (fig.optionKey && !paths.optionDiagrams[fig.optionKey]) {
          paths.optionDiagrams[fig.optionKey] = fig.storagePath;
        }
        break;
    }
  }

  return paths;
}

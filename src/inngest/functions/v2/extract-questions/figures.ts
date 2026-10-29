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
 * Maps already-extracted figures (cropped and uploaded by the ocr-page stage)
 * to resolved questions by serialNo and figure type.
 *
 * In v2 the figure pipeline works like this:
 *   1. OCR returns bounding boxes per question/solution/option.
 *   2. `extractFiguresFromPage` (ocr-page stage) crops the page image at each
 *      bounding box and uploads the PNG to Supabase, producing `ExtractedFigure` entries.
 *   3. This function simply maps those storage paths onto the resolved questions
 *      so they can be persisted into the `question_diagram` / `solution_diagram`
 *      columns (and option diagrams when the DB schema supports them).
 */
export function mapExtractedFiguresToQuestions(
  resolvedQuestions: ResolvedQuestion[],
  allExtractedFigures: ExtractedFigure[],
): Map<number, QuestionDiagramPaths> {
  // Group figures by serialNo
  const figuresBySerialNo = new Map<number, ExtractedFigure[]>();
  for (const fig of allExtractedFigures) {
    const group = figuresBySerialNo.get(fig.serialNo) ?? [];
    group.push(fig);
    figuresBySerialNo.set(fig.serialNo, group);
  }

  const result = new Map<number, QuestionDiagramPaths>();

  for (const q of resolvedQuestions) {
    const figures = figuresBySerialNo.get(q.serialNo);
    if (!figures || figures.length === 0) continue;

    const paths: QuestionDiagramPaths = {
      questionDiagram: null,
      solutionDiagram: null,
      optionDiagrams: {},
    };

    for (const fig of figures) {
      switch (fig.figureType) {
        case "question":
          // Take the first question figure's storage path
          if (!paths.questionDiagram) {
            paths.questionDiagram = fig.storagePath;
          }
          break;
        case "solution":
          // Take the first solution figure's storage path
          if (!paths.solutionDiagram) {
            paths.solutionDiagram = fig.storagePath;
          }
          break;
        case "option":
          if (fig.optionKey && !paths.optionDiagrams[fig.optionKey]) {
            paths.optionDiagrams[fig.optionKey] = fig.storagePath;
          }
          break;
      }
    }

    result.set(q.serialNo, paths);
  }

  return result;
}

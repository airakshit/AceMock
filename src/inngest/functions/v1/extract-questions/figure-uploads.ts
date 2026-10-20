import { Buffer } from "node:buffer";
import { supabaseStorageClient } from "@/features/shared/storage-service";
import { storagePaths } from "@/lib/supabase/storage-paths";
import { firstSvgDocument } from "../extract-figures/svg";

export interface QuestionDiagramUploads {
  questionDiagram: string | null;
  solutionDiagram: string | null;
}

/**
 * Figures are stored as files, never inlined: the diagram column holds a
 * storage path that the read models sign into a URL, and the question card
 * renders it through an image tag.
 */
export async function uploadQuestionFigures(data: {
  userId: string;
  questionId: string;
  questionSvg: string | null;
  solutionSvg: string | null;
}): Promise<QuestionDiagramUploads> {
  const { userId, questionId, questionSvg, solutionSvg } = data;

  const questionSvgDoc = firstSvgDocument(questionSvg);
  const solutionSvgDoc = firstSvgDocument(solutionSvg);

  if (!questionSvgDoc && !solutionSvgDoc) {
    return { questionDiagram: null, solutionDiagram: null };
  }

  const [questionDiagram, solutionDiagram] = await Promise.all([
    questionSvgDoc
      ? uploadSvg(
          storagePaths.getQuestionDiagramPath(userId, questionId, "figure.svg"),
          questionSvgDoc,
        )
      : Promise.resolve(null),
    solutionSvgDoc
      ? uploadSvg(
          storagePaths.getQuestionSolutionDiagramPath(
            userId,
            questionId,
            "figure.svg",
          ),
          solutionSvgDoc,
        )
      : Promise.resolve(null),
  ]);

  return { questionDiagram, solutionDiagram };
}

async function uploadSvg(
  storagePath: string,
  svg: string,
): Promise<string> {
  await supabaseStorageClient.upload(storagePath, Buffer.from(svg, "utf-8"), {
    contentType: "image/svg+xml",
    // Repeat runs of the same document overwrite rather than erroring.
    upsert: true,
  });

  return storagePath;
}

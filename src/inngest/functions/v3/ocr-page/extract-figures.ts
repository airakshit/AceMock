import { supabaseStorageClient } from "@/features/shared/storage-service";
import {
  PDFStoragePathsRetriever,
  ImageStoragePathsRetriever,
} from "@/lib/supabase/storage-paths";
import type { BoundingBox, StructuredPageParseResult } from "./super-schema";
import { computeCropRegion } from "./crop-region";
import {
  START_FRAGMENT_SLOT,
  pathKey,
  segmentsForFilename,
} from "./path-utils";
import sharp from "sharp";

/**
 * An extracted figure from the page. Figures are attached to entities via
 * the canonical PATH KEY (see ./path-utils) — serial numbers no longer
 * exist in v3.
 */
export interface ExtractedFigure {
  /** Canonical path key of the entity this figure belongs to ("" = unlabeled). */
  pathKey: string;
  /** The verbatim path, for debugging/visibility. */
  path?: string[];
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
  /** Document file the figure was cropped from (page numbers restart per file). */
  fileId: string;
}

/**
 * Determines which storage retriever to use based on the file extension.
 */
export type FigureRetriever =
  | typeof PDFStoragePathsRetriever
  | typeof ImageStoragePathsRetriever;

export { computeCropRegion, type CropRegion } from "./crop-region";

export function getStorageRetriever(fileName: string): FigureRetriever {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") {
    return PDFStoragePathsRetriever;
  }
  return ImageStoragePathsRetriever;
}

/**
 * Builds the figure storage path using the appropriate retriever.
 */
export function buildFigureStoragePath(
  retriever: FigureRetriever,
  userId: string,
  documentId: string,
  fileId: string,
  figName: string,
  pageNo: number,
  extension: string,
): string {
  if (retriever === PDFStoragePathsRetriever) {
    return PDFStoragePathsRetriever.getDocumentFileFigures(
      userId,
      documentId,
      fileId,
      figName,
      pageNo,
      extension,
    );
  }
  return ImageStoragePathsRetriever.getDocumentFileFigures(
    userId,
    documentId,
    fileId,
    figName,
    extension,
  );
}

/**
 * Generates a unique figure filename rooted at the entity's PATH.
 * Random suffix (6 chars) guards against collisions; the path segments
 * provide human-readable context, e.g. q-4-ii-question-0-a1b2c3.
 */
export function generateFigureName(input: {
  path?: string[];
  figureType: "question" | "solution" | "option";
  optionKey?: "A" | "B" | "C" | "D";
  index: number;
}): string {
  const typePrefix =
    input.figureType === "question"
      ? "q"
      : input.figureType === "solution"
        ? "s"
        : `opt-${input.optionKey?.toLowerCase() ?? "x"}`;
  const suffix = Math.random().toString(36).slice(2, 8);
  return `path-${segmentsForFilename(input.path)}-${typePrefix}-${input.index}-${suffix}`;
}

/**
 * Downloads an image from a signed URL, crops it to the bounding box,
 * and uploads the cropped figure to Supabase storage.
 */
export async function cropAndUploadFigure(
  signedUrl: string,
  bbox: BoundingBox,
  storagePath: string,
): Promise<string> {
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const imageBuffer = await response.arrayBuffer();

  const image = sharp(Buffer.from(imageBuffer));
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width === 0 || height === 0) {
    throw new Error("Could not determine image dimensions");
  }

  const { left, top, width: cropWidth, height: cropHeight } =
    computeCropRegion(bbox, width, height);

  if (cropWidth <= 0 || cropHeight <= 0) {
    throw new Error(
      `Invalid crop dimensions: ${cropWidth}x${cropHeight} from bbox ${JSON.stringify(bbox)}`,
    );
  }

  const croppedBuffer = await image
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .png()
    .toBuffer();

  await supabaseStorageClient.upload(storagePath, croppedBuffer, {
    contentType: "image/png",
    upsert: true,
  });

  return storagePath;
}

/**
 * Extracts all figures from a merged page OCR result (super-schema shape).
 * Called after the stage-1/stage-2 merge survived validation.
 */
export async function extractFiguresFromPage(
  parsedData: StructuredPageParseResult | undefined,
  signedUrl: string,
  pageNo: number,
  fileId: string,
  userId: string,
  documentId: string,
  fileName: string,
): Promise<ExtractedFigure[]> {
  if (!parsedData) {
    return [];
  }

  const retriever = getStorageRetriever(fileName);
  const extractedFigures: ExtractedFigure[] = [];

  /**
   * Crops one content holder's figures (question / solution / options),
   * shared by entities and page-boundary fragments. A fragment's identity
   * is its refPath when printed, otherwise the synthetic slot the stitcher
   * re-binds to the paired item's real path after merging.
   */
  const extractHolderFigures = async (
    holder: StructuredPageParseResult["entities"][number],
    path: string[] | undefined,
  ): Promise<void> => {
    // Question stem figures
    if (holder.question?.figures?.length) {
      for (let i = 0; i < holder.question.figures.length; i++) {
        const bbox = holder.question.figures[i];
        const figName = generateFigureName({
          path,
          figureType: "question",
          index: i,
        });
        extractedFigures.push(
          await cropEntityFigure(
            retriever,
            userId,
            documentId,
            fileId,
            figName,
            signedUrl,
            bbox,
            pageNo,
            path,
            "question",
          ),
        );
      }
    }

    // Solution figures
    if (holder.solution?.figures?.length) {
      for (let i = 0; i < holder.solution.figures.length; i++) {
        const bbox = holder.solution.figures[i];
        const figName = generateFigureName({
          path,
          figureType: "solution",
          index: i,
        });
        extractedFigures.push(
          await cropEntityFigure(
            retriever,
            userId,
            documentId,
            fileId,
            figName,
            signedUrl,
            bbox,
            pageNo,
            path,
            "solution",
          ),
        );
      }
    }

    // Option figures
    if (holder.options) {
      for (const optionKey of ["A", "B", "C", "D"] as const) {
        const bbox = holder.options[optionKey]?.figure;
        if (!bbox) continue;

        const figName = generateFigureName({
          path,
          figureType: "option",
          optionKey,
          index: 0,
        });
        extractedFigures.push(
          await cropEntityFigure(
            retriever,
            userId,
            documentId,
            fileId,
            figName,
            signedUrl,
            bbox,
            pageNo,
            path,
            "option",
            optionKey,
          ),
        );
      }
    }
  };

  for (const entity of parsedData.entities ?? []) {
    await extractHolderFigures(entity, entity.path);
  }

  // Page-boundary fragments: only the page-TOP fragment can carry figures -
  // the bottom state is a pure path reference with no content. A pathless
  // fragment's boxes were keyed under the synthetic "@start" slot; the
  // stitcher re-binds them to the paired item's real path after the merge.
  const startFragment = parsedData.startState?.obj;
  if (startFragment) {
    const path = parsedData.startState.refPath?.length
      ? parsedData.startState.refPath
      : [START_FRAGMENT_SLOT];
    await extractHolderFigures(startFragment, path);
  }

  return extractedFigures;
}

async function cropEntityFigure(
  retriever: FigureRetriever,
  userId: string,
  documentId: string,
  fileId: string,
  figName: string,
  signedUrl: string,
  bbox: BoundingBox,
  pageNo: number,
  path: string[] | undefined,
  figureType: "question" | "solution" | "option",
  optionKey?: "A" | "B" | "C" | "D",
): Promise<ExtractedFigure> {
  const storagePath = buildFigureStoragePath(
    retriever,
    userId,
    documentId,
    fileId,
    figName,
    pageNo,
    "png",
  );

  await cropAndUploadFigure(signedUrl, bbox, storagePath);

  return {
    pathKey: pathKey(path),
    path,
    figureType,
    optionKey,
    storagePath,
    bbox,
    pageNo,
    fileId,
  };
}

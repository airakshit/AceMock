import { supabaseStorageClient } from "@/features/shared/storage-service";
import { PDFStoragePathsRetriever, ImageStoragePathsRetriever } from "@/lib/supabase/storage-paths";
import type { StructuredSchemaParseResult, BoundingBox } from "./structured-question-schema";
import sharp from "sharp";

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
 * Determines which storage retriever to use based on the file extension/mime type.
 * For now, we default to PDF retriever for multi-page documents and Image retriever for single-page.
 * In practice, this could be determined by the file's mime type stored in the document.
 */
export type FigureRetriever =
  | typeof PDFStoragePathsRetriever
  | typeof ImageStoragePathsRetriever;

export function getStorageRetriever(fileName: string): FigureRetriever {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  // PDF files use page-numbered paths; images use flat paths
  if (ext === "pdf") {
    return PDFStoragePathsRetriever;
  }
  return ImageStoragePathsRetriever;
}

/**
 * Builds the figure storage path using the appropriate retriever.
 * Handles the different signatures between PDF and Image retrievers.
 */
export function buildFigureStoragePath(
  retriever: FigureRetriever,
  userId: string,
  documentId: string,
  fileId: string,
  figName: string,
  pageNo: number,
  extention: string,
): string {
  if (retriever === PDFStoragePathsRetriever) {
    return PDFStoragePathsRetriever.getDocumentFileFigures(
      userId,
      documentId,
      fileId,
      figName,
      pageNo,
      extention,
    );
  }
  return ImageStoragePathsRetriever.getDocumentFileFigures(
    userId,
    documentId,
    fileId,
    figName,
    extention,
  );
}

/**
 * Generates a unique figure filename based on the figure context.
 */
export function generateFigureName(input: {
  serialNo: number;
  figureType: "question" | "solution" | "option";
  optionKey?: "A" | "B" | "C" | "D";
  index: number;
}): string {
  const typePrefix = input.figureType === "question" ? "q"
    : input.figureType === "solution" ? "s"
    : `opt-${input.optionKey}`;
  return `serial-${input.serialNo}-${typePrefix}-${input.index}`;
}

/**
 * Downloads an image from a signed URL, crops it to the bounding box,
 * and uploads the cropped figure to Supabase storage.
 *
 * @param signedUrl - Signed URL to the full page image
 * @param bbox - Normalized bounding box (0-1, origin top-left)
 * @param storagePath - Destination path in Supabase storage
 * @returns The storage path of the uploaded cropped figure
 */
export async function cropAndUploadFigure(
  signedUrl: string,
  bbox: BoundingBox,
  storagePath: string,
): Promise<string> {
  // Download the image
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const imageBuffer = await response.arrayBuffer();

  // Get image metadata to calculate pixel coordinates
  const image = sharp(Buffer.from(imageBuffer));
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width === 0 || height === 0) {
    throw new Error("Could not determine image dimensions");
  }

  // Convert normalized coordinates to pixel coordinates
  const left = Math.round(bbox.xMin * width);
  const top = Math.round(bbox.yMin * height);
  const right = Math.round(bbox.xMax * width);
  const bottom = Math.round(bbox.yMax * height);
  const cropWidth = right - left;
  const cropHeight = bottom - top;

  // Validate crop dimensions
  if (cropWidth <= 0 || cropHeight <= 0) {
    throw new Error(`Invalid crop dimensions: ${cropWidth}x${cropHeight} from bbox ${JSON.stringify(bbox)}`);
  }

  // Crop the image
  const croppedBuffer = await image
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .png() // Convert to PNG for lossless quality
    .toBuffer();

  // Upload to Supabase storage
  await supabaseStorageClient.upload(storagePath, croppedBuffer, {
    contentType: "image/png",
    upsert: true,
  });

  return storagePath;
}

/**
 * Extracts all figures from a page OCR result.
 * This should be called after OCR validation survives.
 *
 * @param parsedData - The parsed structured OCR data
 * @param signedUrl - Signed URL to the full page image
 * @param pageNo - Page number
 * @param fileId - Document file ID
 * @param userId - User ID
 * @param documentId - Document ID
 * @param fileName - Original file name (to determine PDF vs Image retriever)
 * @returns Array of extracted figures with their storage paths
 */
export async function extractFiguresFromPage(
  parsedData: StructuredSchemaParseResult | undefined,
  signedUrl: string,
  pageNo: number,
  fileId: string,
  userId: string,
  documentId: string,
  fileName: string,
): Promise<ExtractedFigure[]> {
  if (!parsedData?.data?.length) {
    return [];
  }

  const retriever = getStorageRetriever(fileName);
  const extractedFigures: ExtractedFigure[] = [];

  for (const item of parsedData.data) {
    const serialNo = item.serialNo;
    if (!serialNo) continue;

    // Extract question stem figures
    if (item.questionFigures?.length) {
      for (let i = 0; i < item.questionFigures.length; i++) {
        const bbox = item.questionFigures[i];
        const figName = generateFigureName({ serialNo, figureType: "question", index: i });
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

        extractedFigures.push({
          serialNo,
          figureType: "question",
          storagePath,
          bbox,
          pageNo,
        });
      }
    }

    // Extract solution figures
    if (item.solutionFigures?.length) {
      for (let i = 0; i < item.solutionFigures.length; i++) {
        const bbox = item.solutionFigures[i];
        const figName = generateFigureName({ serialNo, figureType: "solution", index: i });
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

        extractedFigures.push({
          serialNo,
          figureType: "solution",
          storagePath,
          bbox,
          pageNo,
        });
      }
    }

    // Extract option figures
    if (item.optionFigures) {
      for (const optionKey of ["A", "B", "C", "D"] as const) {
        const bbox = item.optionFigures[optionKey];
        if (!bbox) continue;

        const figName = generateFigureName({ serialNo, figureType: "option", optionKey, index: 0 });
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

        extractedFigures.push({
          serialNo,
          figureType: "option",
          optionKey,
          storagePath,
          bbox,
          pageNo,
        });
      }
    }
  }

  return extractedFigures;
}
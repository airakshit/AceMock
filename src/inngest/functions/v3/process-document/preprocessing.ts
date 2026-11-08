import sharp, { type Metadata } from "sharp";
import { PDFiumLibrary, type PDFiumPageRenderOptions } from "@hyzyla/pdfium";

/**
 * Reused across invocations if your process stays warm (e.g. same
 * Lambda container reused between requests). Cheap to re-init if not.
 */
let pdfiumLibraryPromise: Promise<PDFiumLibrary> | null = null;
function getPdfiumLibrary(): Promise<PDFiumLibrary> {
  if (!pdfiumLibraryPromise) {
    pdfiumLibraryPromise = PDFiumLibrary.init();
  }
  return pdfiumLibraryPromise;
}

const MAX_INPUT_PIXELS = 100_000_000;
const MAX_OCR_PIXELS = 10_000_000;

type SharpMetadata = Metadata;
export interface ProcessedPage {
  pageNumber: number;
  buffer: Buffer;
  width: number;
  height: number;
  contentType: "image/webp";
}

/**
 * Reads width/height off a Sharp metadata result, throwing instead of
 * silently falling back to 0 — an image with unreadable dimensions is
 * a real failure, not a zero-pixel image.
 */
function _requireDimensions(
  metadata: SharpMetadata,
  context: string,
): { width: number; height: number } {
  const { width, height } = metadata;

  if (!width || !height) {
    throw new Error(
      `Could not determine image dimensions (${context}). ` +
        `Got width=${String(width)}, height=${String(height)}`,
    );
  }

  return { width, height };
}

async function _normalizeImageBuffer(buffer: Buffer): Promise<Buffer> {
  const image = sharp(buffer, {
    limitInputPixels: MAX_INPUT_PIXELS,
  }).rotate();

  const metadata = await image.metadata();
  const { width, height } = _requireDimensions(metadata, "source image");
  const pixels = width * height;

  if (pixels > MAX_INPUT_PIXELS) {
    throw new Error(
      `Image is too large to process (${width}x${height} = ${pixels} pixels, ` +
        `max is ${MAX_INPUT_PIXELS})`,
    );
  }

  // Trim first.
  const trimmed = image.trim({
    threshold: 10,
  });

  const trimmedMetadata = await trimmed.metadata();
  const { width: trimmedWidth, height: trimmedHeight } = _requireDimensions(
    trimmedMetadata,
    "trimmed image",
  );
  const trimmedPixels = trimmedWidth * trimmedHeight;

  let pipeline = trimmed;

  if (trimmedPixels > MAX_OCR_PIXELS) {
    const scale = Math.sqrt(MAX_OCR_PIXELS / trimmedPixels);

    pipeline = pipeline.resize({
      width: Math.max(1, Math.floor(trimmedWidth * scale)),
      height: Math.max(1, Math.floor(trimmedHeight * scale)),
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: true,
    });
  }

  return pipeline.sharpen().webp({ quality: 85, lossless: true }).toBuffer();
}

export async function normalizeStandaloneImage(
  imageBuffer: Buffer,
): Promise<ProcessedPage> {
  const buffer = await _normalizeImageBuffer(imageBuffer);
  const metadata = await sharp(buffer).metadata();
  const { width, height } = _requireDimensions(metadata, "normalized output");

  return {
    pageNumber: 1,
    buffer,
    width,
    height,
    contentType: "image/webp",
  };
}

/**
 * Renders every page of a PDF (as a Buffer) into normalized WEBP image buffers.
 * Never touches disk — PDFium runs in WASM, output goes through Sharp in memory.
 *
 * @param pdfBuffer Raw PDF bytes, e.g. from `Buffer.from(await blob.arrayBuffer())`
 * @param scale     Render scale factor. 1 = 72 DPI..
 */
export async function renderPdfToImages(
  pdfBuffer: Buffer,
  scale = 2.5,
): Promise<ProcessedPage[]> {
  const library = await getPdfiumLibrary();
  const document = await library.loadDocument(pdfBuffer);

  try {
    const pages: ProcessedPage[] = [];

    for (let i = 0; i < document.getPageCount(); i++) {
      const page = document.getPage(i);

      // Render straight to a normalized webp buffer via sharp, in one pass.
      const rendered = await page.render({
        scale,
        render: async (options: PDFiumPageRenderOptions) => {
          return _normalizeImageBuffer(
            await sharp(options.data, {
              raw: {
                width: options.width,
                height: options.height,
                channels: 4,
              },
            })
              .webp()
              .toBuffer(),
          );
        },
      });

      // PDFiumPageRenderResult.data is typed as Uint8Array, but the bytes
      // are already a Buffer at runtime (from _normalizeImageBuffer above).
      // Buffer.from on an existing Buffer is a cheap no-copy wrap, not a clone.
      const pageBuffer = Buffer.from(rendered.data);
      const metadata = await sharp(pageBuffer).metadata();
      const { width, height } = _requireDimensions(
        metadata,
        `PDF page ${i + 1}`,
      );

      pages.push({
        pageNumber: i + 1,
        buffer: pageBuffer,
        width,
        height,
        contentType: "image/webp",
      });
    }

    return pages;
  } finally {
    // Always release native/WASM memory, even if rendering throws partway through.
    document.destroy();
  }
}

/**
 * Convenience dispatcher: takes a Blob (as returned by supabase.storage.download())
 * and a mime type, routes to the right processor, returns normalized page(s).
 */
export async function processFileBlob(
  blob: Blob,
  mimeType: string,
): Promise<ProcessedPage[]> {
  const buffer = Buffer.from(await blob.arrayBuffer());

  if (mimeType === "application/pdf") {
    return renderPdfToImages(buffer);
  }

  if (mimeType.startsWith("image/")) {
    return [await normalizeStandaloneImage(buffer)];
  }

  throw new Error(`Unsupported file type for processing: ${mimeType}`);
}

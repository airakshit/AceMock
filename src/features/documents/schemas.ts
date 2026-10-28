import { z } from "zod";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_PDFS = 2;
const MAX_IMAGES = 10;

/**
 * One unified file schema — the form has a single dropzone where PDFs and
 * images coexist, so the allow-list lives on every File instead of in
 * separate pdf/image arrays.
 */
export const documentFileSchema = z.object({
  clientFileId: z.string().uuid(),

  file: z
    .instanceof(File)
    .refine(
      (file) =>
        file.type === "application/pdf" || file.type.startsWith("image/"),
      "Only PDF and image files are allowed",
    )
    .refine(
      (file) => file.size <= MAX_FILE_SIZE,
      "Each file must be smaller than 50 MB",
    ),

  /**
   * File System Access handle captured on drag & drop / picker (Chromium
   * only). Lets a later session re-obtain the file WITHOUT storing any
   * bytes — absent on `<input type=file>` picks and non-Chromium browsers,
   * in which case the probe-verified re-select fallback is used.
   */
  fileHandle: z
    .custom<FileSystemFileHandle | null>(() => true)
    .nullable()
    .optional(),
});

export const documentFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less"),

  description: z
    .string()
    .trim()
    .max(2000, "Description must be 2000 characters or less")
    .optional(),

  files: z
    .array(documentFileSchema)
    .refine(
      (files) => {
        const pdfCount = files.filter(
          (item) => item.file.type === "application/pdf",
        ).length;
        // The refines above already reject anything that isn't a PDF or an
        // image, so the remainder of the list is images.
        const imageCount = files.length - pdfCount;
        return pdfCount <= MAX_PDFS && imageCount <= MAX_IMAGES;
      },
      `You can upload at most ${MAX_PDFS} PDFs and ${MAX_IMAGES} images`,
    ),
});

export type DocumentFileItem = z.infer<typeof documentFileSchema>;
export type DocumentFormData = z.infer<typeof documentFormSchema>;

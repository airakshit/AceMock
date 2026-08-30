import { z } from "zod";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_PDFS = 2;
const MAX_IMAGES = 10;

export const pdfFileSchema = z.object({
  clientFileId: z.string().uuid(),
  file: z
    .instanceof(File)
    .refine(
      (file) => file.type === "application/pdf",
      "Only PDF files are allowed",
    )
    .refine(
      (file) => file.size <= MAX_FILE_SIZE,
      "PDF must be smaller than 50 MB",
    ),
});

export const imageFileSchema = z.object({
  clientFileId: z.string().uuid(),
  file: z
    .instanceof(File)
    .refine(
      (file) => file.type.startsWith("image/"),
      "Only image files are allowed",
    )
    .refine(
      (file) => file.size <= MAX_FILE_SIZE,
      "Each image must be smaller than 50 MB",
    ),
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

  pdfs: z
    .array(pdfFileSchema)
    .max(MAX_PDFS, `You can upload at most ${MAX_PDFS} PDFs`),

  images: z
    .array(imageFileSchema)
    .max(MAX_IMAGES, `You can upload at most ${MAX_IMAGES} images`),
});

type PDFFileItem = z.infer<typeof pdfFileSchema>;
type ImageFileItem = z.infer<typeof imageFileSchema>;

export type DocumentFileItem = PDFFileItem | ImageFileItem;
export type DocumentFormData = z.infer<typeof documentFormSchema>;

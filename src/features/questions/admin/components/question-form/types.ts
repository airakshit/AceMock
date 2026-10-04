import z from "zod";
import { questionFormSchema, imageFileSchema } from "./schemas";

/**
 * Frontend file wrapper for client-side uploads (e.g. diagrams, solutions).
 */
export interface QuestionFileItem {
  clientFileId: string;
  file: File;
}

export type QuestionFormData = z.infer<typeof questionFormSchema>;
export type QuestionImageFile = z.infer<typeof imageFileSchema>;

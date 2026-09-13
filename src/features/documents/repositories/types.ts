import { filePages } from "@/db/schemas";
import { DocumentProcessingStatus } from "../types";

export type Page = typeof filePages.$inferSelect;

export type FullDocumentResult = {
  documentId: string;
  processingStatus: DocumentProcessingStatus;
  files: Array<{
    fileId: string;
    fileName: string;
    pages: Page[];
  }>;
};

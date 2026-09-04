import { filePages } from "@/db/schemas";

export type Page = typeof filePages.$inferSelect;

export type FullDocumentResult = {
  documentId: string;
  files: Array<{
    fileId: string;
    fileName: string;
    pages: Page[];
  }>;
};

import { inngest } from "../client";
import { processFileBlob } from "../documents/document-preprocessing";
import { supabaseStorageClient } from "@/features/shared/storage-service";
import { storagePaths } from "@/lib/supabase/storage-paths";
import { db } from "@/db";
import { documentFilesRepository } from "@/features/documents/repositories/document-files.repository";
import { documentsRepository } from "@/features/documents/repositories/documents.repository";


export interface ProcessDocumentEventData {
  userId: string;
  documentId: string;
}

export const processDocument = inngest.createFunction(
  {
    id: "process-document",
    triggers: { event: "document/process" },
  },

  async ({ event, step }) => {
    const data = event.data as ProcessDocumentEventData;
    const { documentId, userId } = data;


    const docFiles = await step.run("fetch-document-info-with-files", async () => {
      return documentFilesRepository.findByDocument(db, documentId);
    });

    if (!docFiles || docFiles.length === 0) {
      return {
        success: true,
        message: "No files found to process.",
        documentId,
        processedFiles: [],
      };
    }

    // 2. Preprocess each file in parallel using Promise.all and step.run per file
    const processedFiles = await Promise.all(
      docFiles.map((file) =>
        step.run(`preprocess-file-${file.id}`, async () => {
          // Download file blob from Supabase storage
          const downloaded = await supabaseStorageClient.downloadSingle(
            file.storagePath,
          );

          if (!downloaded || !downloaded.data) {
            throw new Error(
              `Failed to download file from storage path: ${file.storagePath}`,
            );
          }

          // Preprocess document blob into normalized page images (WEBP)
          const pages = await processFileBlob(downloaded.data, file.mimeType);

          // Upload each preprocessed page to Supabase storage
          const uploadedPages = await Promise.all(
            pages.map(async (page) => {
              const pageStoragePath = storagePaths.getDocumentFilePageSourceUrl(
                userId,
                documentId,
                file.id as string,
                file.filename || "file",
                "webp",
                page.pageNumber,
              );

              await supabaseStorageClient.upload(pageStoragePath, page.buffer, {
                contentType: page.contentType,
                upsert: true,
              });

              return {
                pageNumber: page.pageNumber,
                storagePath: pageStoragePath,
                width: page.width,
                height: page.height,
                contentType: page.contentType,
              };
            }),
          );

          return {
            id: file.id as string,
            filename: file.filename,
            totalPages: pages.length,
            pages: uploadedPages,
          };
        }),
      ),
    );

    return {
      success: true,
      documentId,
      processedFiles,
    };
  },
);



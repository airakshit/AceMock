import { inngest } from "../client";
import { processFileBlob } from "../documents/document-preprocessing";
import { supabaseStorageClient } from "@/features/shared/storage-service";
import { storagePaths } from "@/lib/supabase/storage-paths";
import { db } from "@/db";
import { documentFilesRepository } from "@/features/documents/repositories/document-files.repository";
import { performance } from "node:perf_hooks";
import { filePagesRepository } from "@/features/documents/repositories/file-pages.repository";

export interface ProcessDocumentEventData {
  userId: string;
  documentId: string;
}

export const processDocument = inngest.createFunction(
  {
    id: "process-document",
    triggers: { event: "document/process" },
  },

  async ({ event, step, logger }) => {
    const data = event.data as ProcessDocumentEventData;
    const { documentId, userId } = data;

    let start = performance.now();

    const docFiles = await step.run(
      `document-${documentId}-files-as-processing`,
      async () => {
        return await documentFilesRepository.updateStatusByDocumentId(
          db,
          documentId,
          "processing",
        );
      },
    );

    logger.info(
      {
        step: "document-files-as-processing",
        finishedIn: `${(performance.now() - start) / 1000}s`,
      },
      "Step Completed.",
    );

    if (!docFiles || docFiles.length === 0) {
      return {
        success: true,
        message: "No files found to process.",
        documentId,
        processedFiles: [],
      };
    }

    const processedFiles = await Promise.all(
      docFiles.map((file) =>
        step.run(`preprocess-file-${file.id}`, async () => {
          // Download file blob from Supabase storage
          start = performance.now();
          const downloaded = await supabaseStorageClient.downloadSingle(
            file.storagePath,
          );

          logger.info(
            {
              file: file.filename,
              function: "downloadSingle",
              finishedIn: `${(performance.now() - start) / 1000}s`,
            },
            "Function Completed.",
          );

          if (!downloaded || !downloaded.data) {
            throw new Error(
              `Failed to download file from storage path: ${file.storagePath}`,
            );
          }

          // Preprocess document blob into normalized page images (WEBP)
          start = performance.now();
          const pages = await processFileBlob(downloaded.data, file.mimeType);
          logger.info(
            {
              file: file.filename,
              function: "processFileBlob",
              finishedIn: `${(performance.now() - start) / 1000}s`,
            },
            "Function Completed.",
          );

          // Upload each preprocessed page to Supabase storage
          logger.info({ pages: pages.length }, "Uploading these pages.");
          start = performance.now();
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

              start = performance.now();
              await supabaseStorageClient.upload(pageStoragePath, page.buffer, {
                contentType: page.contentType,
                upsert: true,
              });
              logger.info(
                {
                  file: file.filename,
                  function: "uploadSinglePage",
                  page: page.pageNumber,
                  finishedIn: `${(performance.now() - start) / 1000}s`,
                },
                "Function Completed.",
              );

              return {
                pageNumber: page.pageNumber,
                storagePath: pageStoragePath,
                width: page.width,
                height: page.height,
                contentType: page.contentType,
              };
            }),
          );

          logger.info(
            {
              function: "uploadfiles",
              files: uploadedPages.length,
              finishedIn: `${(performance.now() - start) / 1000}s`,
            },
            "Function Completed.",
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

    await step.run(`document-${documentId}-files-as-success`, async () => {
      return await documentFilesRepository.updateStatusByDocumentId(
        db,
        documentId,
        "success",
      );
    });

    start = performance.now();
    const pages = await step.run(`create-ready-pages`, async () => {
      const data: Array<{ fileId: string; pageNo: number }> = [];

      processedFiles.forEach((file) => {
        file.pages.forEach((page) => {
          data.push({
            fileId: file.id,
            pageNo: page.pageNumber,
          });
        });
      });
      return await filePagesRepository.createMany(db, data);
    });
    logger.info(
      {
        step: "create-ready-pages",
        createdPages: pages.length,
        finishedIn: `${(performance.now() - start) / 1000}s`,
      },
      "Step Completed.",
    );

    return {
      success: true,
      documentId,
      processedFiles,
    };
  },
);

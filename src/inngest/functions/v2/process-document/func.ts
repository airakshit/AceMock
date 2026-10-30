import { inngest } from "../../../client";
import { processFileBlob } from "./preprocessing";
import { supabaseStorageClient } from "@/features/shared/storage-service";
import { PDFStoragePathsRetriever } from "@/lib/supabase/storage-paths";
import { db } from "@/db";
import { documentRepository } from "@/features/documents/repositories/documents.repository";
import { performance } from "node:perf_hooks";
import {
  DocumentProcessingStatus,
  FileProcessingStatus,
} from "@/features/documents/types";
import { eq } from "drizzle-orm";
import { documentFiles } from "@/db/schemas";
import { generateUUIDv7 } from "@/features/shared/utils";
import { EXTRACT_QUESTIONS_EVENT as EXTRACT_QUESTIONS_EVENT_V2 } from "../extract-questions";

export interface ProcessDocumentEventData {
  userId: string;
  documentId: string;
}

export const PROCESS_DOCUMENT_EVENT = "v2/document/process"

export const processDocument = inngest.createFunction(
  {
    id: "process-document-v2",
    triggers: { event: PROCESS_DOCUMENT_EVENT },
  },

  async ({ event, step, logger }) => {
    const data = event.data as ProcessDocumentEventData;
    const { documentId, userId } = data;

    let start = performance.now();

    await step.run(`mark-document-as-processing-files`, async () => {
      await documentRepository.commands.update(db, {
        documentId: documentId,
        userId: userId,
        status: "processing_files",
      });
    });

    const docFiles = await step.run(`mark-files-as-running`, async () => {
      const files = await documentRepository.commands.updateFileProcessingStatus(db, {
        documentId,
        status: "running" as FileProcessingStatus,
      });

      return files;
    });

    if (!docFiles || docFiles.length === 0) {
      await step.run(`mark-document-as-failed-no-files`, async () => {
        await documentRepository.commands.update(db, {
          documentId: documentId,
          userId: userId,
          status: "failed",
        });
      });

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
              const pageStoragePath = PDFStoragePathsRetriever.getDocumentFilePageSourceUrl(
                userId,
                documentId,
                file.id as string,

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

    await step.run(`mark-files-as-completed`, async () => {
      const files = await documentRepository.commands.updateFileProcessingStatus(db, {
        documentId,
        status: "completed" as FileProcessingStatus,
      });

      return files;
    });

    start = performance.now();
    const pages = await step.run(`create-ready-pages`, async () => {
      const data: Array<{ id: string; fileId: string; pageNo: number }> = [];

      processedFiles.forEach((file) => {
        file.pages.forEach((page) => {
          data.push({
            id: generateUUIDv7(),
            fileId: file.id,
            pageNo: page.pageNumber as number,
          });
        });
      });
      const createdPages = await documentRepository.commands.createManyFilePages(
        db,
        data,
      );
      return createdPages;
    });

    logger.info(
      {
        step: "create-ready-pages",
        createdPages: pages.length,
        finishedIn: `${(performance.now() - start) / 1000}s`,
      },
      "Step Completed.",
    );

    if (pages.length === 0) {
      await step.run("mark-document-as-failed-no-pages", async () => {
        await documentRepository.commands.update(db, {
          documentId,
          userId,
          status: "failed",
        });
      });

      return {
        success: false,
        message: "No pages generated from processed files.",
        documentId,
      };
    }

    // Trigger question extraction workflow asynchronously
    await step.sendEvent("trigger-extract-questions", {
      name: EXTRACT_QUESTIONS_EVENT_V2,
      data: {
        userId,
        documentId,
      },
    });

    return {
      success: true,
      documentId,
      processedFiles,
    };
  },
);

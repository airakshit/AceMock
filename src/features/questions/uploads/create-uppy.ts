"use client";

import Uppy from "@uppy/core";
import Tus from "@uppy/tus";
import { env } from "@/config/env/client";
import { QUESTION_UPPY_UPLOAD_CONFIG } from "./upload.config";
import { QuestionUploadMeta } from "./upload.types";

export function createQuestionUppy() {
  const uppy = new Uppy<QuestionUploadMeta>({
    autoProceed: false,

    restrictions: {
      maxNumberOfFiles: 5,
      maxFileSize: QUESTION_UPPY_UPLOAD_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024,
    },

    allowMultipleUploadBatches: false,
  });

  uppy.use(Tus, {
    endpoint: QUESTION_UPPY_UPLOAD_CONFIG.TUS_ENDPOINT,
    limit: QUESTION_UPPY_UPLOAD_CONFIG.MAX_CONCURRENT_UPLOAD,
    retryDelays: QUESTION_UPPY_UPLOAD_CONFIG.RETRY_DELAYS,
    chunkSize: QUESTION_UPPY_UPLOAD_CONFIG.CHUNK_SIZE_MB * 1024 * 1024,

    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    // Remember the tus upload URL per fingerprint (localStorage) so that a
    // restarted transfer can continue from the last sent offset instead of
    // starting over.
    storeFingerprintForResuming: true,

    allowedMetaFields: QUESTION_UPPY_UPLOAD_CONFIG.ALLOWED_METADATA_FIELDS,

    headers: (file) => {
      const token: string = file.meta.uploadToken as string;
      if (!token) {
        throw new Error(`No token available for file: ${file.name}`);
      }
      return {
        apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
        "x-signature": token,
        "x-upsert": "true",
      };
    },
  });

  uppy.on("error", (error) => {
    console.error("[uppy:error] Question uploader global error:", error);
  });

  uppy.on("upload-error", (file, error, response) => {
    console.error(
      "[uppy:upload-error] File:",
      file?.name,
      "Error:",
      error,
      "Response:",
      response,
    );
  });

  return uppy;
}

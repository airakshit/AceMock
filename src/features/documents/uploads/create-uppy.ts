"use client";

import Uppy from "@uppy/core";
import Tus from "@uppy/tus";
import { env } from "@/config/env/client";
import { UPPY_UPLOAD_CONFIG } from "./upload.config";
import { DocumentUploadMeta } from "./upload.types";

export function createDocumentUppy() {
    const uppy = new Uppy<DocumentUploadMeta>({
        autoProceed: false,

        restrictions: {
            maxNumberOfFiles: 20,
            maxFileSize: 500 * 1024 * 1024,
        },

        allowMultipleUploadBatches: false,
    });

    uppy.use(Tus, {
        endpoint: UPPY_UPLOAD_CONFIG.TUS_ENDPOINT,
        limit: UPPY_UPLOAD_CONFIG.MAX_CONCURRENT_UPLOAD,
        retryDelays: UPPY_UPLOAD_CONFIG.RETRY_DELAYS,
        chunkSize: UPPY_UPLOAD_CONFIG.CHUNK_SIZE_MB * 1024 * 1024,

        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        storeFingerprintForResuming: false,

        /**
         * Only these fields should become
         * TUS metadata.
         *
         * uploadToken must NOT be sent as
         * TUS metadata.
         */
        allowedMetaFields: UPPY_UPLOAD_CONFIG.ALLOWED_METADATA_FIELDS,

        headers: (file) => {
            const token: string = file.meta.uploadToken as string;
            if (!token) {
                throw new Error(`No token available for file: ${file.name}`);
            }
            return {
                // apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
                // Authorization: `Bearer ${token}`,
                "x-signature": token,
                "x-upsert": "true",
            };
        },
    });

    uppy.on("error", (error) => {
        console.error("[uppy:error] Global error:", error);
    });

    uppy.on("upload-error", (file, error, response) => {
        console.error("[uppy:upload-error] File:", file?.name, "Error:", error, "Response:", response);
    });

    uppy.on("upload-success", (file, response) => {
        console.log("[uppy:upload-success] File:", file?.name, "Response:", response);
    });

    uppy.on("upload-progress", (file, progress) => {
        console.log("[uppy:upload-progress] File:", file?.name, "Progress:", progress);
    });

    return uppy;
}

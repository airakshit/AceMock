"use client";

import Uppy, { type UppyFile } from "@uppy/core";
import Tus from "@uppy/tus";
import type { HttpRequest, HttpResponse } from "tus-js-client";
import { env } from "@/config/env/client";
import { UPPY_UPLOAD_CONFIG } from "./upload.config";
import { DocumentUploadMeta } from "./upload.types";

/**
 * Decodes the TUS `Upload-Metadata` header value.
 * Value format: comma-separated `key base64Value` pairs.
 */
function parseTusMetadata(headerValue?: string | null): Record<string, string> {
  if (!headerValue) return {};
  const result: Record<string, string> = {};
  for (const pair of headerValue.split(",")) {
    const [key, b64Value] = pair.trim().split(" ");
    if (key && b64Value) {
      try {
        result[key] = atob(b64Value);
      } catch {
        // Ignore malformed base64
      }
    }
  }
  return result;
}

/**
 * Finds the corresponding Uppy file for a TUS request by
 * decoding the TUS `Upload-Metadata` header.
 */
export function findFileByRequest(
  req: HttpRequest,
  uppy: Uppy<DocumentUploadMeta>,
): UppyFile<DocumentUploadMeta, Record<string, never>> | undefined {
  const metadata = parseTusMetadata(req.getHeader("Upload-Metadata"));
  const files = uppy.getFiles();

  if (metadata.serverFileId) {
    const file = files.find((f) => f.meta.serverFileId === metadata.serverFileId);
    if (file) return file;
  }

  // Matches the object name
  if (metadata.objectName) {
    const file = files.find((f) => f.meta.objectName?.trim() === metadata.objectName.trim());
    if (file) return file;
  }

  return undefined;
}

export function createDocumentUppy(): Uppy<DocumentUploadMeta> {
  /**
   * Tracks in-flight or completed DB persistence promises for TUS endpoints.
   * Keyed by serverFileId to prevent redundant network and DB calls.
   * Scoped to this Uppy instance to prevent state bleeding across batches.
   */
  const pendingSaveTusRef = new Map<string, Promise<void>>();

  const uppy = new Uppy<DocumentUploadMeta>({
    autoProceed: false,

    restrictions: {
      maxNumberOfFiles: 20,
      maxFileSize: UPPY_UPLOAD_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024,
    },

    allowMultipleUploadBatches: false,
  });

  uppy.use(Tus, {
    endpoint: UPPY_UPLOAD_CONFIG.TUS_ENDPOINT,
    limit: UPPY_UPLOAD_CONFIG.MAX_CONCURRENT_UPLOAD,
    retryDelays: UPPY_UPLOAD_CONFIG.RETRY_DELAYS,
    chunkSize: UPPY_UPLOAD_CONFIG.CHUNK_SIZE_MB * 1024 * 1024,
    storeFingerprintForResuming: false,

    /**
     * Only these fields should become TUS metadata.
     * uploadToken must NOT be sent as TUS metadata.
     */
    allowedMetaFields: UPPY_UPLOAD_CONFIG.ALLOWED_METADATA_FIELDS,

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

    /**
     * Captures TUS endpoint immediately when Supabase returns 201 Created
     * on the initial POST and triggers saving the endpoint reference in parallel.
     * Uses an API route instead of a Next.js Server Action to allow concurrent requests.
     */
    onAfterResponse: async (req: HttpRequest, res: HttpResponse) => {
      if (req.getMethod() !== "POST" || res.getStatus() !== 201) return;

      const location = res.getHeader("Location");
      if (!location) return;

      const file = findFileByRequest(req, uppy);
      if (!file) {
        console.warn("[uppy:tus] File cannot be identified from request metadata in onAfterResponse");
        return;
      }
      const serverFileId = file.meta.serverFileId;
      const sessionId = file.meta.sessionId;

      if (serverFileId && sessionId && !pendingSaveTusRef.has(serverFileId)) {
        const savePromise = (async () => {
          const response = await fetch("/api/documents/upload-ref", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId,
              documentFileId: serverFileId,
              uploadRef: location,
            }),
          });

          const result = await response.json().catch(() => null);

          if (!response.ok || !result?.success) {
            const errorMsg =
              result?.error?.message ||
              `HTTP ${response.status}: Failed to save TUS endpoint`;
            console.error(
              "[uppy:tus] Failed to save TUS endpoint reference:",
              result?.error ?? errorMsg,
            );
            throw new Error(errorMsg);
          }
        })();

        pendingSaveTusRef.set(serverFileId, savePromise);
      }
    },

    /**
     * Synchronization Barrier:
     * Never allow ANY byte chunk (PATCH) to be sent until the TUS endpoint
     * has been confirmed and saved in the database!
     */
    onBeforeRequest: async (req, file) => {
      if (req.getMethod() === "PATCH") {
        const serverFileId = (file?.meta as DocumentUploadMeta | undefined)
          ?.serverFileId;
        if (serverFileId) {
          const savePromise = pendingSaveTusRef.get(serverFileId);
          if (savePromise) {
            await savePromise;
          }
        }
      }
    },
  });

  uppy.on("error", (error) => {
    console.error("[uppy:error] Global error:", error);
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

  uppy.on("cancel-all", () => {
    pendingSaveTusRef.clear();
  });

  return uppy;
}

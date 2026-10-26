"use client";

import Uppy from "@uppy/core";
import Tus from "@uppy/tus";
import { env } from "@/config/env/client";
import { UPPY_UPLOAD_CONFIG } from "./upload.config";
import { DocumentUploadMeta } from "./upload.types";

/**
 * Fires the moment a new TUS resource URL is learned, with the server
 * identity of the file it belongs to.
 */
export type UploadRefCreatedHandler = (
  serverFileId: string,
  uploadRef: string,
) => void;

/**
 * Late-bound sink for the immediate upload-ref sync. The uppy/TUS
 * transport is session-agnostic (created once per provider mount), while
 * the UploadSessionCoordinator is per-session — so the coordinator
 * registers itself here for the time it owns the session
 * (setUploadRefHandler / clearUploadRefHandler).
 *
 * WeakMap keyed by the uppy instance: no React refs involved (never read
 * during render) and no leak if the provider remounts.
 */
const uploadRefHandlers = new WeakMap<
  Uppy<DocumentUploadMeta>,
  UploadRefCreatedHandler
>();

/** Minimal structural shape of the installed @uppy/tus plugin. */
interface TusPluginLike {
  /** Public per-file tus.Upload instances kept by the plugin. */
  uploaders: Record<string, { url?: string | null } | null>;
}

export function createDocumentUppy(): Uppy<DocumentUploadMeta> {
  const uppy = new Uppy<DocumentUploadMeta>({
    autoProceed: false,

    restrictions: {
      maxNumberOfFiles: 20,
      // Keep in sync with the zod schema in ../schemas.ts (50 MB per file).
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
        apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
        "x-signature": token,
        "x-upsert": "true",
      };
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

  return uppy;
}

/**
 * Route TUS `POST → 201 + Location` events to the given coordinator
 * while it owns the session. Pass `null` to detach.
 */
export function setUploadRefHandler(
  uppy: Uppy<DocumentUploadMeta>,
  handler: UploadRefCreatedHandler | null,
): void {
  if (handler) {
    uploadRefHandlers.set(uppy, handler);
  } else {
    uploadRefHandlers.delete(uppy);
  }
}

/**
 * IMMEDIATE upload-ref sync, wiring per FILE.
 *
 * tus-js-client exposes exactly the moment the TUS endpoint exists:
 * inside `_createUpload`, right after `this.url = resolveUrl(...)` (the
 * create request's `Location` header), it invokes
 * `options.onUploadUrlAvailable()` — synchronously, before any chunk is
 * PATCHed, on every resource creation (fresh upload AND upload-retry).
 *
 * The callback receives NO arguments, so the file mapping is resolved by
 * attaching a SUB-CALLBACK PER FILE here, before the batch starts. The
 * per-file options reach tus-js-client through @uppy/tus's per-file
 * merge (`...(file.tus || {})` in startUpload), and the closure reads
 * the fresh URL from the plugin's public `uploaders[uppyFileId].url` —
 * already assigned at callback time. Continuing an EXISTING resource
 * (resume/PATCH) never fires it, so a resumed plan cannot double-save.
 *
 * Fire-and-forget by construction: the sink (`saveUploadRef`) owns the
 * server action asynchronously. After the create the per-file state
 * read by the heartbeat-tick fallback sweep is the authority anyway.
 */
export function attachOnUploadUrlAvailable(
  uppy: Uppy<DocumentUploadMeta>,
  uppyFileId: string,
  serverFileId: string,
): void {
  const plugin = uppy.getPlugin("Tus") as TusPluginLike | null;
  if (!plugin) return;

  uppy.setFileState(uppyFileId, {
    tus: {
      // Preserve any per-file tus options already set.
      ...(uppy.getFile(uppyFileId)?.tus ?? {}),
      onUploadUrlAvailable: () => {
        try {
          const uploadRef = plugin.uploaders[uppyFileId]?.url;
          if (!uploadRef) return;

          // No sink registered (no active session coordinator)? Then
          // nothing is fired and the heartbeat-tick sweep stays the
          // fallback.
          uploadRefHandlers.get(uppy)?.(serverFileId, uploadRef);
        } catch (error) {
          // A broken hook must never break the upload itself; the
          // coordinator's heartbeat ref-sync is the fallback.
          console.error("[uppy:tus] upload-ref hook failed:", error);
        }
      },
    },
  });
}

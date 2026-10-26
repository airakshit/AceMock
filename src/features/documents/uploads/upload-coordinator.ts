"use client";

import type Uppy from "@uppy/core";
import type { UppyFile } from "@uppy/core";

import type { DocumentUploadMeta } from "./upload.types";
import {
  completeDocumentFileUploadAction,
} from "../actions/complete-document-file-upload";
import { completeUploadSessionAction } from "../actions/complete-upload-session";
import { heartbeatUploadSessionAction } from "../actions/heartbeat-upload-session";
import { saveUploadReferenceAction } from "../actions/save-upload-reference";
import {
  UPLOAD_HEARTBEAT_INTERVAL_MS,
} from "./upload-session-constants";

/**
 * Upload session coordinator (client side of the server-owned session).
 *
 * Hold the exclusive Web Lock `upload-session:{documentId}` for the
 * lifetime of an upload attempt in this browser. If another tab already
 * owns it, the lock is NOT available and this coordinator refuses to run
 * â†’ the user sees "uploading in another tab".
 *
 * While the lock is held it:
 *  - heartbeats the server every 25s (progress snapshot included),
 *  - pushes every TUS resource reference it discovers into the server
 *    (saveUploadReference) so recovery decisions are server-owned,
 *  - flips each finished file to `uploaded` (completeDocumentFileUpload),
 *  - commits the session (completeUploadSession) once Uppy's batch ends
 *    with everything transferred.
 *
 * The coordinator is deliberately NOT a React component: it outlives form
 * remounts and reports through callbacks.
 */

const TUS_LOCK_PREFIX = "upload-session:";

export interface UploadCoordinatorConfig {
  documentId: string;
  sessionId: string;
  /** The shared Uppy instance running the batch. */
  uppy: Uppy<DocumentUploadMeta>;
  /** Called when the lock is owned by another tab â€” the batch must NOT start. */
  onLockUnavailable: () => void;
  /** Called once the session has been committed (or terminally lost). */
  onSessionFinished: (outcome: "completed" | "lost") => void;
  /** Non-fatal errors (single file failed to finalize etc.). */
  onError: (message: string) => void;
}

interface ProgressSnapshot {
  documentFileId: string;
  status: "uploading" | "uploaded";
  offsetBytes?: number;
}

export class UploadSessionCoordinator {
  private readonly uppy: Uppy<DocumentUploadMeta>;
  private readonly documentId: string;
  private readonly sessionId: string;

  private readonly onLockUnavailable: () => void;
  private readonly onSessionFinished: (outcome: "completed" | "lost") => void;
  private readonly onError: (message: string) => void;

  /**
   * `serverFileId:uploadRef` keys whose TUS resource reference has been
   * saved server-side — dedupes the immediate create-response hook
   * against the heartbeat-tick fallback sweep.
   */
  private savedRefKeys = new Set<string>();
  /** In-flight completeDocumentFileUpload requests (awaited before commit). */
  private pendingCompletions = new Set<Promise<unknown>>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private detachFns: Array<() => void> = [];
  private isStopped = false;
  /** Resolves the Web Lock request callback â†’ releasing the lock. */
  private releaseLock: (() => void) | null = null;
  /**
   * Set even before the lock callback runs: if `stop()` wins the race
   * against the lock callback (e.g. the provider unmounted between the
   * lock request being scheduled and executing), the lifecycle must
   * never begin and the lock must be released immediately.
   */
  private stopRequested = false;
  private pagehideFlush: () => void = () => {};

  constructor(config: UploadCoordinatorConfig) {
    this.uppy = config.uppy;
    this.documentId = config.documentId;
    this.sessionId = config.sessionId;
    this.onLockUnavailable = config.onLockUnavailable;
    this.onSessionFinished = config.onSessionFinished;
    this.onError = config.onError;
  }

  /**
   * Acquires `upload-session:{documentId}` (if available) and runs the
   * whole coordinator lifecycle INSIDE the lock callback, so the lock is
   * held until the session turns terminal (completed / lost) or `stop()`
   * is called.
   *
   * Resolves `true` as soon as the lifecycle has begun — NOT when the
   * lock is released. The caller (provider) must be able to start the
   * TUS batch right away while the coordinator keeps running in the
   * background under the lock; awaiting the full lock request here would
   * deadlock the flow (the batch would never start, only heartbeats
   * would run).
   */
  async start(): Promise<boolean> {
    const locks = navigator.locks;
    this.stopRequested = false;

    if (!locks) {
      console.warn(
        "[upload-coordinator] Web Locks API unavailable — running without cross-tab guard.",
      );
      this.beginLifecycle();
      return true;
    }

    return await new Promise<boolean>((resolveStart) => {
      void locks.request(
        `${TUS_LOCK_PREFIX}${this.documentId}`,
        { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            // Another tab owns this document's session.
            resolveStart(false);
            this.onLockUnavailable();
            return;
          }

          if (this.stopRequested) {
            // stop() won the race during the async gap before the
            // callback executed — bail out without starting the
            // lifecycle; returning releases the lock immediately.
            resolveStart(false);
            return;
          }

          this.beginLifecycle();
          // Let the caller proceed (start the batch) — the lock itself is
          // held until the session turns terminal or stop() resolves.
          resolveStart(true);

          await new Promise<void>((resolveLock) => {
            this.releaseLock = resolveLock;
          });

          this.endLifecycle();
        },
      );
    });
  }

  /**
   * Leaves the lifecycle (releases the Web Lock). Used when the session is
   * lost remotely, or when the user resets the form mid-session and the
   * attempt should simply go quiet and become resumable later.
   */
  stop(): void {
    this.stopRequested = true;
    this.isStopped = true;
    this.releaseLock?.();
    this.releaseLock = null;
    this.endLifecycle();
  }

  // -----------------------------------------------------------------------
  // Upload-ref sync
  // -----------------------------------------------------------------------

  /**
   * IMMEDIATE ref-sync: hand a freshly created TUS resource URL to the
   * server the moment it exists.
   *
   * Uppy's TUS plugin fires this the instant Supabase's create request
   * returns `201 + Location` (see create-uppy.ts onAfterResponse). Waiting
   * for the next heartbeat tick would leave the uploadRef unknown to the
   * server for up to 25s — a tab close inside that window would lose a
   * perfectly good resumable resource and degrade its resume path to a
   * full re-upload (TUS resources live ~24h, tokens 2h).
   *
   * The heartbeat tick keeps calling this too as a safety-net sweep; the
   * `serverFileId:uploadRef` key makes the two paths mutually idempotent.
   */
  async saveUploadRef(serverFileId: string, uploadRef: string): Promise<void> {
    if (this.isStopped || this.stopRequested) return;

    const key = `${serverFileId}:${uploadRef}`;
    if (this.savedRefKeys.has(key)) return;
    this.savedRefKeys.add(key);

    try {
      await saveUploadReferenceAction({
        sessionId: this.sessionId,
        documentFileId: serverFileId,
        uploadRef,
      });
    } catch (error) {
      // The heartbeat sweep remains the safety net; a missed ref only
      // degrades the next resume to the re-upload path.
      console.error("[upload-coordinator] saveUploadReference failed:", error);
    }
  }

  // -----------------------------------------------------------------------
  // Lifecycle internals
  // -----------------------------------------------------------------------

  private beginLifecycle() {
    this.isStopped = false;

    // Fallback ref-sync sweep shortly after the batch starts — the
    // authoritative refs arrive via the TUS create-response hook
    // (saveUploadRef), this catches anything the hook might have missed
    // and then double-checks every UPLOAD_HEARTBEAT_INTERVAL_MS.
    setTimeout(() => this.tick(), 1500);

    this.heartbeatTimer = setInterval(
      () => void this.tick(),
      UPLOAD_HEARTBEAT_INTERVAL_MS,
    );

    // Per-file completion from Uppy's authoritative success event.
    const onUploadSuccess = (file?: UppyFile<DocumentUploadMeta, Record<string, never>>) => {
      if (!file) return;
      void this.handleFileTransferred(file);
    };
    this.uppy.on("upload-success", onUploadSuccess);

    // Batch finished â†’ commit the session once all per-file flips land.
    const onComplete = () => {
      void this.handleBatchComplete();
    };
    this.uppy.on("complete", onComplete);

    this.detachFns = [
      () => this.uppy.off("upload-success", onUploadSuccess),
      () => this.uppy.off("complete", onComplete),
    ];

    // Flush one heartbeat when the tab is hidden/closed â€” the server gets
    // the very latest offsets even if this is the last beat.
    this.pagehideFlush = () => {
      void this.tick({ flushOnly: true });
    };
    window.addEventListener("pagehide", this.pagehideFlush);
  }

  private endLifecycle() {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const detach of this.detachFns) detach();
    this.detachFns = [];

    window.removeEventListener("pagehide", this.pagehideFlush);
  }

  private sessionFiles() {
    return this.uppy
      .getFiles()
      .filter((file) => file.meta?.serverFileId);
  }

  /**
   * One heartbeat tick: ref-sync + progress heartbeat.
   */
  private async tick(options: { flushOnly?: boolean } = {}) {
    if (this.isStopped) return;

    const files = this.sessionFiles();

    // 1. Ref-sync fallback sweep: push any TUS resource URL known to
    // Uppy's file state that the immediate create-response hook has not
    // already saved (deduped by savedRefKeys inside saveUploadRef).
    if (!options.flushOnly) {
      for (const file of files) {
        const uploadRef = file.tus?.uploadUrl;
        if (!uploadRef) continue;

        await this.saveUploadRef(
          file.meta.serverFileId as string,
          uploadRef,
        );
      }
    }

    // 2. Progress snapshot heartbeat.
    const progress: ProgressSnapshot[] = files.map((file) => ({
      documentFileId: file.meta.serverFileId as string,
      status: file.progress?.uploadComplete
        ? ("uploaded" as const)
        : ("uploading" as const),
      offsetBytes:
        typeof file.progress?.bytesUploaded === "number"
          ? Math.max(0, Math.floor(file.progress.bytesUploaded))
          : undefined,
    }));

    try {
      const result = await heartbeatUploadSessionAction({
        sessionId: this.sessionId,
        files: progress,
      });

      if (!result.success) {
        // The server refused us (session terminal / recovery elapsed).
        this.onError(
          "The upload session was closed on the server. You can resume it from the document list.",
        );
        this.stop();
        this.onSessionFinished("lost");
      }
    } catch {
      // Transient network failure is NOT fatal and NOT a file failure â€”
      // the next tick reconciles.
      console.warn("[upload-coordinator] heartbeat failed (transient).");
    }
  }

  /**
   * Server tells the DB this file's bytes are in (uploaded). Awaited
   * before committing the session â€” no lost flips on browser close.
   */
  private async handleFileTransferred(file: UppyFile<DocumentUploadMeta, Record<string, never>>) {
    const serverFileId = file.meta?.serverFileId;
    if (!serverFileId) return;

    const completion = (async () => {
      try {
        const result = await completeDocumentFileUploadAction({
          sessionId: this.sessionId,
          documentFileId: serverFileId,
        });
        if (!result.success) {
          this.onError(result.error.message);
        }
      } catch (error) {
        console.error("[upload-coordinator] complete file failed:", error);
        this.onError(
          "Could not confirm a completed file with the server â€” resume from the document list if the upload stalls.",
        );
      }
    })();

    this.pendingCompletions.add(completion);
    try {
      await completion;
    } finally {
      this.pendingCompletions.delete(completion);
    }
  }

  /**
   * Uppy batch ended. When nothing failed â†’ await outstanding per-file
   * completes â†’ commit (`completeUploadSession`). With failures â†’ leave
   * the session active; the files stay resumable exactly where they are.
   */
  private async handleBatchComplete() {
    if (this.isStopped) return;

    const sessionFiles = this.sessionFiles();
    const allSettled = sessionFiles.every(
      (file) => file.progress?.uploadComplete || file.error,
    );

    if (!allSettled) return;

    const failed = sessionFiles.filter((file) => file.error);
    if (failed.length > 0) {
      return; // resumable interruption â€” commit later on resume
    }

    try {
      await Promise.all(Array.from(this.pendingCompletions));

      const result = await completeUploadSessionAction({
        sessionId: this.sessionId,
      });

      if (!result.success) {
        this.onError(result.error.message);
        return;
      }

      if (result.data.unreconciledFiles.length > 0) {
        this.onError(
          `${result.data.unreconciledFiles.length} file(s) could not be verified in storage â€” re-upload them after re-selecting.`,
        );
        return;
      }

      this.onSessionFinished("completed");
      this.stop();
    } catch (error) {
      console.error("[upload-coordinator] session commit failed:", error);
      this.onError("Finalizing the upload session failed â€” you can resume from the document list.");
    }
  }
}


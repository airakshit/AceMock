"use client";

import type Uppy from "@uppy/core";
import type { UppyFile } from "@uppy/core";

import type { DocumentUploadMeta } from "./upload.types";
import { completeDocumentFileUploadAction } from "../actions/complete-document-file-upload";
import { completeUploadSessionAction } from "../actions/complete-upload-session";
import { heartbeatUploadSessionAction } from "../actions/heartbeat-upload-session";
import { UPLOAD_HEARTBEAT_INTERVAL_MS } from "./upload-session-constants";

/**
 * Upload session coordinator (client side of the server-owned session).
 * Implements WebLock API to prevent simultaneous uplaods from different tabs.
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
  /** Called when the lock is owned by another tab. */
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

  /** In-flight completeDocumentFileUpload requests (awaited before commit). */
  private pendingCompletions = new Set<Promise<unknown>>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private detachFns: Array<() => void> = [];
  private isStopped = false;
  /** Resolves the Web Lock request callback by releasing the lock. */
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

    // If the first promise is not resolved before the second promise, it will await till
    // is resolved.
    return await new Promise<boolean>((resolveStart) => {
      // locks.request returns a promise
      // void states that the promise is deliberately not awaited
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

          // Awaits till it is resolved. using this.releaseLock()
          await new Promise<void>((resolveLock) => {
            this.releaseLock = resolveLock;
          });

          // Runs only after this.releaseLock() is called from somewhere.
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

  private beginLifecycle() {
    this.isStopped = false;

    this.heartbeatTimer = setInterval(
      () => void this.tick(),
      UPLOAD_HEARTBEAT_INTERVAL_MS,
    );

    // Per-file completion from Uppy's authoritative success event.
    const onUploadSuccess = (
      file?: UppyFile<DocumentUploadMeta, Record<string, never>>,
    ) => {
      if (!file) return;
      void this.handleFileTransferred(file);
    };
    this.uppy.on("upload-success", onUploadSuccess);

    // Batch finished â†’ commit the session once all per-file flips land.
    const onComplete = () => {
      void this.handleBatchComplete();
    };
    this.uppy.on("complete", onComplete);

    // Removes the event listeners from uppy.
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
    return this.uppy.getFiles().filter((file) => file.meta?.serverFileId);
  }

  /**
   * One heartbeat tick: ref-sync + progress heartbeat.
   */
  private async tick(options: { flushOnly?: boolean } = {}) {
    if (this.isStopped) return;

    const files = this.sessionFiles();

    // Progress snapshot heartbeat.
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
      this.onError(
        "Finalizing the upload session failed â€” you can resume from the document list.",
      );
    }
  }
}

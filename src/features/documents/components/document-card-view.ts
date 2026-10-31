"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Loader2,
  PauseCircle,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  DocumentFileDTO,
  DocumentUploadSessionSearchData,
} from "../dto/projections";
import type {
  DocumentProcessingStatus,
  FileUploadStatus,
} from "../types";
import type { UploadStatus } from "../uploads/upload.types";
import { UPLOAD_HEARTBEAT_STALE_MS } from "../uploads/upload-session-constants";

// ---------------------------------------------------------------------------
// Card mode
// ---------------------------------------------------------------------------

/**
 * The three mutually exclusive ways a DocumentCard renders. Keeping this
 * as an explicit union (resolved in ONE place, right at the top of the
 * card) is what makes the component readable:
 *
 * - `display`  — pure render of the server DTO. This tab holds no live
 *   upload state for this document; every byte of truth comes from
 *   get-user-documents. Resume is offered only as an explicit ACTION
 *   (R2) when the session heartbeat is stale.
 * - `uploading` — THIS tab's coordinator owns the session (created here,
 *   or resumed here). Live Uppy progress is joined onto the server rows.
 * - `resuming`  — a resume bootstrap is running for this document, or it
 *   is waiting for the user to re-select files whose content could not
 *   be restored from persisted handles.
 */
export type DocumentCardMode = "display" | "uploading" | "resuming";

export function resolveDocumentCardMode(params: {
  documentId: string;
  /** Document this tab currently coordinates (provider state). */
  activeDocumentId: string | null;
  /** A resume bootstrap/re-select flow is active for this document. */
  isResumingThisDocument: boolean;
}): DocumentCardMode {
  if (params.activeDocumentId === params.documentId) return "uploading";
  if (params.isResumingThisDocument) return "resuming";
  return "display";
}

// ---------------------------------------------------------------------------
// File-level status + aggregates
// ---------------------------------------------------------------------------

/**
 * Client-facing file status. The server lifecycle intentionally separates
 * "all bytes transferred" (`uploaded`) from "verified + committed"
 * (`completed`) — but that is bookkeeping the user should not have to
 * interpret: if the bytes are in storage, the file is simply uploaded.
 * See UploadFlow.md.
 */
export function clientFacingFileStatus(
  status: FileUploadStatus,
): Exclude<FileUploadStatus, "completed"> {
  return status === "completed" ? "uploaded" : status;
}

export interface DocumentFilesSummary {
  pdfCount: number;
  imageCount: number;
  totalSize: number;
}

/**
 * Processing needs every byte in storage — a document with any file still
 * pending/uploading/failed must NOT offer the Process action (the card
 * offers Resume Upload for those instead).
 */
export function areAllFilesUploaded(files: DocumentFileDTO[]): boolean {
  return (
    files.length > 0 &&
    files.every(
      (f) => f.uploadStatus === "uploaded" || f.uploadStatus === "completed",
    )
  );
}

export function summarizeFiles(files: DocumentFileDTO[]): DocumentFilesSummary {
  const pdfCount = files.filter(
    (f) =>
      f.mimeType === "application/pdf" ||
      f.filename.toLowerCase().endsWith(".pdf"),
  ).length;
  const imageCount = files.filter(
    (f) =>
      f.mimeType.startsWith("image/") ||
      (!f.mimeType.includes("pdf") &&
        !f.filename.toLowerCase().endsWith(".pdf")),
  ).length;
  const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);

  return { pdfCount, imageCount, totalSize };
}

// ---------------------------------------------------------------------------
// Document-level status badge
// ---------------------------------------------------------------------------

export interface DocumentStatusView {
  label: string;
  icon: LucideIcon;
  className: string;
  spin: boolean;
}

/**
 * Status shown while THIS tab coordinates the session — overrides the
 * server-derived view entirely (live truth beats a stale snapshot).
 */
export const LIVE_UPLOAD_STATUS_VIEW: DocumentStatusView = {
  label: "Uploading Files",
  icon: Loader2,
  className: "border-info/30 bg-info/10 text-info",
  spin: true,
};

export const LIVE_RESUME_STATUS_VIEW: DocumentStatusView = {
  label: "Resuming Upload",
  icon: Loader2,
  className: "border-info/30 bg-info/10 text-info",
  spin: true,
}

export interface DocumentStatusInput {
  processingStatus: DocumentProcessingStatus;
  files: DocumentFileDTO[];
  session: DocumentUploadSessionSearchData | null;
  /**
   * Staleness clock snapshot (0 = not yet ticking — treated as "fresh",
   * since Date.now() is not callable during render).
   */
  nowMs: number;
}

/**
 * Pure resolution of the server-derived status badge — the `display`
 * mode's single source of truth. Order matters: interrupted/failed
 * upload states must never be masked by processing states, and the
 * "Uploaded" fallback (not processed but fully transferred) must not
 * fire while a transfer is genuinely still in flight.
 */
export function resolveDocumentStatusView(
  input: DocumentStatusInput,
): DocumentStatusView {
  const { processingStatus, files, session: uploadSession, nowMs } = input;

  const hasPendingTransferFiles = files.some(
    (f) =>
      f.uploadStatus === "pending" ||
      f.uploadStatus === "uploading" ||
      f.uploadStatus === "failed",
  );

  const heartbeatAgeMs =
    nowMs > 0 && uploadSession
      ? nowMs - new Date(uploadSession.lastHeartbeatAt).getTime()
      : 0;

  /**
   * Session-derived staleness: an ACTIVE upload session whose heartbeat
   * is stale (>120s — browser closed/crashed) means the attempt is
   * *interrupted*, not live: offer manual resume instead of a spinner.
   */
  const isUploadInterruptedNow =
    (uploadSession?.status === "active" &&
      hasPendingTransferFiles &&
      heartbeatAgeMs > UPLOAD_HEARTBEAT_STALE_MS) ||
    (uploadSession !== null &&
      uploadSession.status === "abandoned" &&
      hasPendingTransferFiles);

  if (isUploadInterruptedNow) {
    return {
      label: "Upload Interrupted",
      icon: PauseCircle,
      className: "border-warning/30 bg-warning/10 text-warning",
      spin: false,
    };
  }

  // Live upload: heartbeat is fresh.
  if (files.some((f) => f.uploadStatus === "uploading")) {
    return {
      label: "Uploading Files",
      icon: Loader2,
      className: "border-info/30 bg-info/10 text-info",
      spin: true,
    };
  }

  if (files.some((f) => f.uploadStatus === "failed")) {
    return {
      label: "Upload Failed",
      icon: AlertTriangle,
      className: "border-danger/30 bg-danger/10 text-danger",
      spin: false,
    };
  }

  // Document processing statuses.
  if (processingStatus === "processing_files") {
    return {
      label: "Processing Files...",
      icon: Loader2,
      className: "border-info/40 bg-info/15 text-info font-medium",
      spin: true,
    };
  }

  if (processingStatus === "extracting_questions") {
    return {
      label: "Extracting Questions...",
      icon: Sparkles,
      className: "border-brand/40 bg-brand/15 text-brand font-medium animate-pulse",
      spin: true,
    };
  }

  if (processingStatus === "merging_questions") {
    return {
      label: "Merging Questions...",
      icon: Layers,
      className: "border-brand/40 bg-brand/15 text-brand font-medium animate-pulse",
      spin: true,
    };
  }

  if (processingStatus === "completed") {
    return {
      label: "Completed",
      icon: CheckCircle2,
      className: "border-success/30 bg-success/10 text-success font-medium",
      spin: false,
    };
  }

  if (processingStatus === "failed") {
    return {
      label: "Processing Failed",
      icon: AlertTriangle,
      className: "border-danger/30 bg-danger/10 text-danger font-medium",
      spin: false,
    };
  }

  /**
   * Not processed yet — but "Pending" is only honest when there is
   * still something in flight. If every file's bytes are already in
   * storage, the state is "Uploaded" (the Process button already tells
   * the user that extraction has not run).
   */
  if (areAllFilesUploaded(files)) {
    return {
      label: "Uploaded",
      icon: CheckCircle2,
      className: "border-success/30 bg-success/10 text-success font-medium",
      spin: false,
    };
  }

  /**
   * Files still to transfer with a FRESH heartbeat — the upload is
   * running in another tab (or just started, before any file flipped
   * to "uploading"): show the live state, not Pending.
   */
  if (
    uploadSession?.status === "active" &&
    hasPendingTransferFiles &&
    heartbeatAgeMs <= UPLOAD_HEARTBEAT_STALE_MS
  ) {
    return {
      label: "Uploading Files",
      icon: Loader2,
      className: "border-info/30 bg-info/10 text-info",
      spin: true,
    };
  }

  return {
    label: "Pending",
    icon: Clock,
    className: "border-warning/30 bg-warning/10 text-warning font-medium",
    spin: false,
  };
}

// ---------------------------------------------------------------------------
// Live (Uppy) file badge — UploadStatus → pill styling
// ---------------------------------------------------------------------------

/**
 * Pill styling for LIVE Uppy file states, mirroring the design-system's
 * `colors.status` family (same palettes, different key set).
 */
export type LiveFileBadgeEntry = {
  label: string;
  className: string;
};

export const LIVE_FILE_BADGE: Record<
  UploadStatus,
  LiveFileBadgeEntry
> = {
  idle: {
    label: "Queued",
    className: "bg-muted/60 text-muted-foreground border-border/50",
  },
  preparing: {
    label: "Preparing",
    className: "bg-info/10 text-info border-info/25",
  },
  uploading: {
    label: "Uploading",
    className: "bg-warning/10 text-warning border-warning/25",
  },
  paused: {
    label: "Paused",
    className: "bg-warning/10 text-warning border-warning/25",
  },
  success: {
    label: "Uploaded",
    className: "bg-success/10 text-success border-success/25",
  },
  error: {
    label: "Failed",
    className: "bg-danger/10 text-danger border-danger/25",
  },
};
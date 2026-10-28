/**
 * The recovery decision table (UploadFlow.md §11) as a pure function.
 *
 * Both the server (resumeDocumentUpload) and the tests consume this — the
 * client NEVER runs it: resume eligibility is always decided server-side.
 * Uppy fingerprints do not appear anywhere in these rules.
 */

import type { FileUploadStatus } from "../types";

export type FileRecoveryAction =
  /** Existing TUS resource is valid — continue from the probed offset. */
  | "resume"
  /** No valid TUS resource — start a fresh upload (same storagePath, upsert). */
  | "reupload"
  /** File is terminal — nothing to do. */
  | "skip";

export interface RecoveryFileSnapshot {
  uploadStatus: FileUploadStatus;
  /** Stored TUS resource reference (may be missing for pending files). */
  uploadRef: string | null | undefined;
  /** True when uploadRefCreatedAt is inside the provider's TUS lifetime. */
  isReferenceWithinProviderLifetime: boolean;
}

/** Result of the server-side HEAD probe; null when no probe was performed. */
export type TusProbeOutcome =
  | { ok: true; offsetBytes: number }
  | { ok: false; reason: "missing" | "unauthorized" | "unknown" }
  | null;

export function decideFileRecoveryAction(
  snapshot: RecoveryFileSnapshot,
  probe: TusProbeOutcome,
): FileRecoveryAction {
  if (snapshot.uploadStatus === "uploaded") return "skip";

  if (snapshot.uploadStatus === "uploading") {
    const mayProbe =
      Boolean(snapshot.uploadRef) &&
      snapshot.isReferenceWithinProviderLifetime;

    // Validity known (probe ran and succeeded) → continue the resource.
    if (mayProbe && probe && probe.ok) return "resume";

    // Otherwise — missing reference, expired provider lifetime, dead
    // resource (404/410), refused access, or an unknown HEAD failure —
    // the safe path is a fresh upload into the same storagePath
    // (x-upsert: true makes overwrite-from-scratch safe).
    return "reupload";
  }

  // pending (never started), failed, cancelled, expired → fresh upload.
  return "reupload";
}

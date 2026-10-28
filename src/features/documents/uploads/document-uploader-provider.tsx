"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  createDocumentUppy,
} from "./create-uppy";
import { useDocumentUploader } from "./use-document-uploader";
import { isProbeVerified } from "./upload-probe";
import {
  deleteSessionRecord,
  loadSessionRecord,
  saveSessionRecord,
  sweepSessionRecords,
  ensureFSHandleReadAccess,
  ensureFSHandlesReadAccess,
  type PersistedUploadSessionRecord,
} from "./upload-session-storage";
import { UploadSessionCoordinator } from "./upload-coordinator";
import { resumeDocumentUploadAction } from "../actions/resume-document-upload";
import type {
  DocumentFileRecoveryPlan,
  FileRecoveryAction,
} from "../actions/types";
import type { SignedUrlResponseObject } from "@/features/shared/storage-service";
import type { DocumentFileItem } from "../schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResumableFileView {
  clientFileId: string;
  serverFileId: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  /** Server-expected content probe (re-select verification). */
  contentProbe: string | null;
  /** Server recovery plan for this file. */
  action: FileRecoveryAction;
  /** Fresh, short-lived token minted by the resume server action. */
  token: string;
  /** Existing TUS resource to continue (only for action === "resume"). */
  uploadRef: string | null;
  /** Server-confirmed byte offset (only for action === "resume"). */
  offsetBytes: number | null;
  /**
   * Restored File — from the persisted File System Access handle.
   * null when it must be re-selected by the user.
   */
  file: File | null;
}

export interface ResumeTarget {
  documentId: string;
  sessionId: string;
  title: string;
  description: string | null;
  /** Files (with restored blobs) already enqueued into the fresh Uppy batch. */
  files: ResumableFileView[];
  /** Files whose content could not be restored — need a probe-verified re-select. */
  filesNeedingReselect: ResumableFileView[];
  /** Files the server transferred/committed already; resume skips them. */
  skippedServerFileIds: string[];
}

export type UploaderContextValue = ReturnType<typeof useDocumentUploader> & {
  /** Set while a resume session is being bootstrapped. */
  isResumeBusy: boolean;
  /**
   * The document whose upload session THIS tab currently coordinates
   * (null when this tab owns no live upload). Cards use it to decide
   * whether they render live progress or pure server data.
   */
  activeDocumentId: string | null;
  /**
   * Non-null while a resumed session has files pending re-selection —
   * cleared when the session's coordinator finishes. The re-select UI's
   * data source (its host component is decided by the view layer).
   */
  resumeTarget: ResumeTarget | null;
  startResume: (documentId: string) => Promise<void>;
  /**
   * Attaches a user-reselected File to one of the session's files and
   * immediately continues the upload. The file must pass the content-probe
   * check — filename/size matches alone are never trusted.
   */
  attachReselectedFile: (view: ResumableFileView, file: File) => Promise<void>;
  /**
   * Creates + starts the server-owned session for a brand-new document
   * (called after createDocumentAction succeeded; the provider owns
   * IndexedDB persistence, the Web Lock and the coordinator).
   */
  beginUploadSession: (params: BeginUploadSessionParams) => Promise<boolean>;
  /**
   * Lets the documents list pass known doc ids through, so persisted
   * sessions for deleted/cron-cleaned documents get purged from IndexedDB.
   */
  notifyKnownDocuments: (documentIds: string[]) => void;
};

export interface BeginUploadSessionParams {
  documentId: string;
  sessionId: string;
  title: string;
  description: string | null;
  files: DocumentFileItem[];
  /** Content probe per clientFileId, computed before the create action. */
  probes: Map<string, string>;
  /** File System Access handles per clientFileId (drag & drop, Chromium). */
  fileHandles: Map<string, FileSystemFileHandle | null>;
  credentials: SignedUrlResponseObject[];
  onLocked: () => void;
}

const DocumentUploaderContext = createContext<UploaderContextValue | null>(
  null,
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toCredential(
  plan: {
    serverFileId: string;
    storagePath: string;
    token: string;
  },
  clientFileId: string,
): SignedUrlResponseObject {
  return {
    serverFileId: plan.serverFileId,
    clientFileId,
    storagePath: plan.storagePath,
    token: plan.token,
    signedUrl: "",
  };
}

/**
 * Rehydrates a File for a recovery-plan entry from the persisted File
 * System Access handle, re-verifying content with the probe (the file on
 * disk may have changed since the session started).
 */
async function restoreFileViaHandle(
  plan: DocumentFileRecoveryPlan,
  handle: FileSystemFileHandle | null,
): Promise<File | null> {
  if (!handle) return null;

  try {
    /**
     * MDN query → request → getFile pattern (see UploadFlow.md):
     * Chromium reverts access to a persisted handle after every page
     * load, and calling getFile() directly in that state throws
     * "The request is not allowed by the user agent or the platform in
     * the current context". Query → request (inside the Resume click
     * gesture) → only then getFile().
     */
    if (!(await ensureFSHandleReadAccess(handle))) {
      return null; // access refused/expired → re-select fallback
    }

    let file = await handle.getFile();

    // Cheap sanity: exact size drift means the identity probe WILL fail —
    // skip the hashing and go straight to the re-select fallback.
    if (file.size !== plan.fileSize) return null;

    if (!(await isProbeVerified(file, plan.contentProbe))) return null;

    // Present the original name to Uppy (handles expose on-disk names).
    if (file.name !== plan.filename) {
      file = new File([file], plan.filename, {
        type: file.type,
        lastModified: file.lastModified,
      });
    }

    return file;
  } catch (error) {
    console.error("[DocumentUploaderProvider] handle restore failed:", error);
    return null;
  }
}



export function DocumentUploaderProvider({
  children,
}: {
  children: ReactNode;
}) {
  /**
   * IMPORTANT: Uppy must only be created once — this provider owns the
   * single instance for the whole documents view.
   */
  const [uppy] = useState(createDocumentUppy);

  const [resumeTarget, setResumeTarget] = useState<ResumeTarget | null>(null);
  const [isResumeBusy, setIsResumeBusy] = useState(false);
  /**
   * The document whose upload session THIS tab currently coordinates
   * (create or resume). The document card reads this to flip into its
   * live "uploading" mode; cleared when the coordinator finishes.
   */
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(
    null,
  );

  const uploader = useDocumentUploader(uppy);

  const coordinatorRef = useRef<UploadSessionCoordinator | null>(null);
  const sessionMetaRef = useRef<{
    documentId: string;
    sessionId: string;
    title: string;
    description: string | null;
  } | null>(null);
  const isResumeBusyRef = useRef(false);

  useEffect(
    () => () => {
      // Unmount of the whole provider (full page leave): stop the
      // coordinator — the server session simply goes quiet and stays
      // resumable. We must NOT cancel in-flight uploads here.
      coordinatorRef.current?.stop();
    },
    [uppy],
  );

  /**
   * Graceful offline handling: tus `retryDelays` recovers from transient
   * drops, but an explicit offline → paused / online → resume cycle won't
   * waste retries during long outages and keeps the heartbeat meaningful.
   */
  const autoPausedDuringOfflineRef = useRef(false);

  useEffect(() => {
    const handleOffline = () => {
      const currentUploads = uppy.getState().currentUploads ?? {};
      if (Object.keys(currentUploads).length === 0) return;
      uppy.pauseAll();
      autoPausedDuringOfflineRef.current = true;
    };

    const handleOnline = () => {
      if (!autoPausedDuringOfflineRef.current) return;
      autoPausedDuringOfflineRef.current = false;
      uppy.resumeAll();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [uppy]);

  const notifyKnownDocuments = useCallback((documentIds: string[]) => {
    void sweepSessionRecords(documentIds).catch((error) =>
      console.error("[DocumentUploaderProvider] sweep failed:", error),
    );
  }, []);

  const startCoordinator = useCallback(
    async (sessionId: string, documentId: string): Promise<boolean> => {
      const uppyInstance = uppy;

      const coordinator = new UploadSessionCoordinator({
        documentId,
        sessionId,
        uppy: uppyInstance,
        onLockUnavailable: () => {
          toast.error(
            "This upload is already running in another browser tab.",
          );
        },
        onSessionFinished: (outcome) => {
          if (outcome === "completed") {
            // The attempt is DONE — the persistence record goes away and
            // the session is terminal server-side (never revived).
            void deleteSessionRecord(documentId);
            // The list refetches so cards flip to the committed server
            // statuses (uploaded/completed) without a manual refresh.
            window.dispatchEvent(new Event("documents:refresh"));
          }
          setActiveDocumentId((current) =>
            current === documentId ? null : current,
          );
          setResumeTarget((current) =>
            current?.documentId === documentId ? null : current,
          );
          coordinatorRef.current = null;
          sessionMetaRef.current = null;
        },
        onError: (message) => toast.error(message),
      });

      coordinatorRef.current = coordinator;
      const acquired = await coordinator.start();
      if (acquired) {
        setActiveDocumentId(documentId);
      }
      return acquired;
    },
    [uppy],
  );

  /**
   * Create path — after createDocumentAction returned document + session +
   * credentials. Metadata is persisted (never blobs), then the batch runs
   * under the session's Web Lock.
   */
  const beginUploadSession = useCallback(
    async (params: BeginUploadSessionParams): Promise<boolean> => {
      uppy.cancelAll();

      const record: PersistedUploadSessionRecord = {
        documentId: params.documentId,
        sessionId: params.sessionId,
        title: params.title,
        description: params.description,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        files: params.files.map((item) => ({
          documentFileId:
            params.credentials.find(
              (c) => c.clientFileId === item.clientFileId,
            )?.serverFileId ?? "",
          clientFileId: item.clientFileId,
          filename: item.file.name,
          mimeType: item.file.type || "application/octet-stream",
          fileSize: item.file.size,
          lastModified: item.file.lastModified,
          storagePath:
            params.credentials.find((c) => c.clientFileId === item.clientFileId)
              ?.storagePath ?? "",
          contentProbe: params.probes.get(item.clientFileId) ?? "",
          fileHandle:
            params.fileHandles.get(item.clientFileId) ?? null,
        })),
      };

      await saveSessionRecord(record);

      uploader.addFiles(params.files.map((item) => ({
        clientFileId: item.clientFileId,
        file: item.file,
      })));
      uploader.setCredentials(
        params.credentials,
        params.documentId,
        params.sessionId,
      );

      const acquired = await startCoordinator(
        params.sessionId,
        params.documentId,
      );

      if (!acquired) {
        await deleteSessionRecord(params.documentId);
        return false;
      }

      await uploader.upload();
      return true;
    },
    [uppy, uploader, startCoordinator],
  );

  /**
   * Resume an interrupted upload. Called ONLY by the explicit
   * "Resume upload" button on the document card; new document creations
   * never look at prior attempts (no hijack of abandoned sessions).
   *
   * The recovery plan comes from the SERVER (it decides resume/reupload/
   * verify-commit/skip after HEAD-probing stored TUS resources) — local
   * state only supplies restorable files, never resume decisions.
   */
  const startResume = useCallback(
    async (documentId: string) => {
      if (isResumeBusyRef.current) return;

      isResumeBusyRef.current = true;
      setIsResumeBusy(true);

      try {
        // 1. Server-side recovery algorithm (decision table + HEAD probes).
        const result = await resumeDocumentUploadAction({ documentId });
        if (!result.success) {
          toast.error(result.error.message);
          return;
        }
        const { document, files: plans, canResume, reason } = result.data;

        if (!canResume) {
          // Only reachable in a stale-UI race; the card already gates this.
          const reasonText =
            reason === "session-expired"
              ? "The recovery window for this upload has elapsed."
              : reason === "no-session"
                ? "There is no upload session to continue."
                : "This upload can no longer be continued.";
          toast.error(reasonText);
          return;
        }

        // 2. Local persistence record (metadata + FS handles only).
        const persisted = await loadSessionRecord(documentId);
        const persistedByDocumentFileId = new Map(
          (persisted?.files ?? []).map((f) => [f.documentFileId, f]),
        );

        // 3. Fresh batch boundary on the shared Uppy instance.
        uppy.cancelAll();

        const restorable: ResumableFileView[] = [];
        const needingReselect: ResumableFileView[] = [];
        const skippedServerFileIds: string[] = [];

        /**
         * Batched permission wave: request read access for EVERY
         * restorable persisted handle in ONE concurrent burst inside
         * this click's user activation (see ensureFSHandlesReadAccess).
         * Doing it per file — after hashing each file's probe — risks
         * the activation expiring mid-list and permissions getting
         * denied/dismissed later in the loop.
         */
        const restoreEntries = plans.filter(
          (plan) =>
            plan.action !== "skip"
        );
        const handleGrants = await ensureFSHandlesReadAccess(
          restoreEntries.map(
            (plan) =>
              persistedByDocumentFileId.get(plan.serverFileId)?.fileHandle ??
              null,
          ),
        );

        for (const [entryIndex, plan] of restoreEntries.entries()) {
          const view: ResumableFileView = {
            clientFileId:
              persistedByDocumentFileId.get(plan.serverFileId)?.clientFileId ??
              crypto.randomUUID(),
            serverFileId: plan.serverFileId,
            storagePath: plan.storagePath,
            filename: plan.filename,
            mimeType: plan.mimeType,
            fileSize: plan.fileSize,
            contentProbe: plan.contentProbe,
            action: plan.action,
            token: plan.token ?? "",
            uploadRef: plan.uploadRef,
            offsetBytes: plan.offsetBytes,
            file: null,
          };

          // Permission was refused (or no handle): do NOT prompt again
          // per file — go straight to the re-select fallback.
          const restorableHandle =
            handleGrants[entryIndex] === true
              ? (persistedByDocumentFileId.get(plan.serverFileId)?.fileHandle ??
                null)
              : null;

          const restoredFile = await restoreFileViaHandle(
            plan,
            restorableHandle,
          );

          if (restoredFile) {
            view.file = restoredFile;
            restorable.push(view);
          } else {
            needingReselect.push(view);
          }
        }

        const pendingPlans = plans.filter(
          (p) => p.action === "resume" || p.action === "reupload",
        );

        if (pendingPlans.length === 0) {
          // Nothing to transfer — refresh the record dropped and just report.
          await deleteSessionRecord(documentId);
          toast.info(
            "All files of this attempt are already uploaded — finalizing.",
          );
          return;
        }

        // 4. Refresh the persistence record from the recovery plan so a
        //    browser close mid-resume keeps the CURRENT truth.
        const refreshedRecord: PersistedUploadSessionRecord = {
          documentId,
          sessionId: result.data.sessionId,
          title: document.title,
          description: document.description,
          createdAt: persisted?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
          files: pendingPlans.map((plan) => {
            const existing = persistedByDocumentFileId.get(plan.serverFileId);
            const restored = restorable.find(
              (v) => v.serverFileId === plan.serverFileId,
            );
            return {
              documentFileId: plan.serverFileId,
              clientFileId:
                existing?.clientFileId ??
                crypto.randomUUID(),
              filename: plan.filename,
              mimeType: plan.mimeType,
              fileSize: plan.fileSize,
              lastModified: restored?.file?.lastModified ?? existing?.lastModified ?? 0,
              storagePath: plan.storagePath,
              contentProbe: plan.contentProbe ?? existing?.contentProbe ?? "",
              // Keep the original handle if the restore came from it.
              fileHandle:
                (restored ? (existing?.fileHandle ?? null) : null) ?? null,
            };
          }),
        };
        await saveSessionRecord(refreshedRecord);

        // 5. Enqueue restorable files and inject per-file TUS resources
        //    from the SERVER plan (never from local fingerprints).
        if (restorable.length > 0) {
          uploader.addFiles(
            restorable.map((view) => ({
              clientFileId: view.clientFileId,
              file: view.file!,
            })),
          );
          uploader.setCredentials(
            restorable.map((view) =>
              toCredential(
                {
                  serverFileId: view.serverFileId,
                  storagePath: view.storagePath,
                  token: view.token,
                },
                view.clientFileId,
              ),
            ),
            documentId,
            result.data.sessionId,
          );

          // Server-decided continuation URLs, injected per file — the
          // @uppy/tus plugin merges `file.tus` into its upload options,
          // so these files resume the exact resource the server probed.
          for (const view of restorable) {
            if (view.action !== "resume" || !view.uploadRef) continue;

            const uppyFile = uploader
              .getFiles()
              .find(
                (f) =>
                  f.meta?.clientFileId === view.clientFileId ||
                  f.id === view.clientFileId,
              );

            if (uppyFile) {
              uppy.setFileState(uppyFile.id, {
                tus: { uploadUrl: view.uploadRef },
              });
            }
          }
        }

        // 6. Publish the resume target (the re-select flow's data source),
        //    then start the batch.
        setResumeTarget({
          documentId: document.documentId,
          sessionId: result.data.sessionId,
          title: document.title,
          description: document.description,
          files: restorable,
          filesNeedingReselect: needingReselect,
          skippedServerFileIds,
        });

        sessionMetaRef.current = {
          documentId,
          sessionId: result.data.sessionId,
          title: document.title,
          description: document.description,
        };

        if (restorable.length > 0) {
          const acquired = await startCoordinator(
            result.data.sessionId,
            documentId,
          );
          if (acquired) {
            await uploader.upload();
          }
        } else if (needingReselect.length > 0) {
          toast.info(
            `${needingReselect.length} file(s) must be re-selected to continue — content is verified before upload resumes.`,
          );
        }
      } catch (error) {
        console.error("[DocumentUploaderProvider] resume failed:", error);
        toast.error("Failed to resume upload.");
        coordinatorRef.current?.stop();
        coordinatorRef.current = null;
      } finally {
        isResumeBusyRef.current = false;
        setIsResumeBusy(false);
      }
    },
    [uppy, uploader, startCoordinator],
  );

  /**
   * Re-select fallback: probe-verified identity, then continue the same
   * session. A name/size match alone NEVER passes.
   */
  const attachReselectedFile = useCallback(
    async (view: ResumableFileView, file: File) => {
      const documentId = resumeTarget?.documentId;
      if (!documentId) return;

      if (!(await isProbeVerified(file, view.contentProbe))) {
        toast.error(
          `The selected file does not match the original content of "${view.filename}". Pick the exact file you started with.`,
        );
        return;
      }

      try {
        uppy.addFile({
          id: view.clientFileId,
          name: view.filename,
          type: view.mimeType || file.type,
          data: file,
          meta: { clientFileId: view.clientFileId },
        });

        uploader.setCredentials(
          [
            toCredential(
              {
                serverFileId: view.serverFileId,
                storagePath: view.storagePath,
                token: view.token,
              },
              view.clientFileId,
            ),
          ],
          documentId,
          resumeTarget.sessionId,
        );

        // A re-selected file whose server plan says "resume" must STILL
        // continue the server-probed TUS resource — inject the URL exactly
        // like the restored-file path does.
        if (view.action === "resume" && view.uploadRef) {
          const uppyFile = uploader
            .getFiles()
            .find(
              (f) =>
                f.meta?.clientFileId === view.clientFileId ||
                f.id === view.clientFileId,
            );

          if (uppyFile) {
            uppy.setFileState(uppyFile.id, {
              tus: { uploadUrl: view.uploadRef },
            });
          }
        }

        // Persist the re-selected file's identity for future recovery
        // (metadata only — bytes never stored).
        const persisted = await loadSessionRecord(documentId);
        if (persisted) {
          await saveSessionRecord({
            ...persisted,
            updatedAt: Date.now(),
            files: persisted.files.map((f) =>
              f.documentFileId === view.serverFileId
                ? { ...f, lastModified: file.lastModified, fileHandle: null }
                : f,
            ),
          });
        }

        const remaining = (resumeTarget.filesNeedingReselect ?? []).filter(
          (v) => v.serverFileId !== view.serverFileId,
        );

        setResumeTarget((prev) =>
          prev
            ? {
              ...prev,
              files: [...prev.files, { ...view, file }],
              filesNeedingReselect: remaining,
            }
            : prev,
        );

        // All files present → start (or continue) the batch.
        if (remaining.length === 0) {
          const meta = sessionMetaRef.current;
          const sessionId =
            resumeTarget.sessionId ?? meta?.sessionId ?? "";

          const alreadyRunning = coordinatorRef.current !== null;
          if (!alreadyRunning) {
            const acquired = await startCoordinator(sessionId, documentId);
            if (!acquired) return;
          }
          await uploader.upload();
        }
      } catch (error) {
        console.error("[DocumentUploaderProvider] reselect failed:", error);
        toast.error("Could not attach the re-selected file.");
      }
    },
    [uppy, uploader, resumeTarget, startCoordinator],
  );

  const contextValue = useMemo<UploaderContextValue>(() => {
    return {
      ...uploader,
      isResumeBusy,
      activeDocumentId,
      resumeTarget,
      startResume,
      attachReselectedFile,
      beginUploadSession,
      notifyKnownDocuments,
    };
  }, [
    uploader,
    isResumeBusy,
    activeDocumentId,
    resumeTarget,
    startResume,
    attachReselectedFile,
    beginUploadSession,
    notifyKnownDocuments,
  ]);

  return (
    <DocumentUploaderContext.Provider value={contextValue}>
      {children}
    </DocumentUploaderContext.Provider>
  );
}


export function useDocumentUploaderContext(): UploaderContextValue {
  const ctx = useContext(DocumentUploaderContext);
  if (!ctx) {
    throw new Error(
      "useDocumentUploaderContext must be used inside <DocumentUploaderProvider>.",
    );
  }
  return ctx;
}

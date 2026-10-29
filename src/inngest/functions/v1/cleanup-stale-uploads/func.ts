import { db } from "@/db";
import { inngest } from "../../../client";
import { supabaseStorageClient } from "@/features/shared/storage-service";
import { PDFStoragePathsRetriever } from "@/lib/supabase/storage-paths";
import { documentsRepository } from "@/features/documents/repositories/documents.repository";
import { uploadSessionsRepository } from "@/features/documents/repositories/upload-sessions.repository";
import type { FileUploadStatus } from "@/features/documents/types";

export const CLEANUP_STALE_UPLOADS_CRON = "0 * * * *";

/**
 * Reclaims upload sessions the client abandoned (browser closed or crashed
 * and never resumed) once their absolute recovery window has elapsed.
 *
 * Abandonment is defined by `upload_sessions.recovery_expires_at` — NOT by
 * heartbeat grace alone: the recovery window is the authoritative, client-
 * agnostic deadline after which resumability ends. Sessions still active
 * inside the window (even with stale heartbeats) stay resumable.
 *
 * Per expired ACTIVE session, best-effort:
 *   1. mark the session `abandoned` (terminal; stamp endedAt + endReason)
 *   2. mark its non-terminal files `failed`
 *   3. delete partial storage objects of files that never finished
 *      transferring (their folders) — fully-uploaded files keep their bytes
 * The document row is intentionally kept so the abandoned attempt remains
 * visible in "Your Documents" and the user can delete it themselves.
 */
export const cleanupStaleUploads = inngest.createFunction(
  {
    id: "cleanup-abandoned-upload-sessions",
    triggers: [{ cron: CLEANUP_STALE_UPLOADS_CRON }],
  },
  async ({ step, logger }) => {
    const expiredSessions = await step.run(
      "find-expired-active-sessions",
      async () => {
        return uploadSessionsRepository.findStaleActiveSessions(
          db,
          new Date(),
        );
      },
    );

    if (expiredSessions.length === 0) {
      logger.info("No abandoned upload sessions to reclaim.");
      return { abandonedSessions: [] };
    }

    logger.info(
      `Reclaiming ${expiredSessions.length} abandoned upload session(s).`,
    );

    for (const session of expiredSessions) {
      await step.run(`abandon-session-${session.id}`, async () => {
        const files = await documentsRepository.findFilesBySessionId(
          db,
          session.id,
        );

        const unfinished = files.filter(
          (f) =>
            f.uploadStatus === "pending" ||
            f.uploadStatus === "uploading" ||
            f.uploadStatus === "failed",
        );

        // 1. Files that never finished: mark failed (terminal for the
        //    attempt), delete their partial bytes.
        for (const file of unfinished) {
          await step.run(`cleanup-file-${file.id}`, async () => {
            const fileStorageFolder = PDFStoragePathsRetriever.getDocumentFilePath(
              session.userId,
              session.documentId,
              file.id,
            );

            try {
              await supabaseStorageClient.deleteFolder(fileStorageFolder);
            } catch (error) {
              logger.error(
                `Failed to delete storage folder for file ${file.id}:`,
                { error },
              );
            }

            if (file.storagePath) {
              try {
                await supabaseStorageClient.deleteFiles([file.storagePath]);
              } catch {
                // Ignored: same object likely already removed above.
              }
            }

            await documentsRepository.updateFilesUploadStatus(db, {
              documentId: session.documentId,
              fileIds: [file.id],
              uploadStatus: "failed" as FileUploadStatus,
            });

            return { fileId: file.id };
          });
        }

        // 2. The session itself becomes terminal — never revived.
        await uploadSessionsRepository.updateStatus(db, {
          sessionId: session.id,
          status: "abandoned",
          endReason: "recovery-window-elapsed",
        });

        return {
          sessionId: session.id,
          cleanedFiles: unfinished.map((f) => f.id),
        };
      });
    }

    return {
      abandonedSessions: expiredSessions.map((s) => s.id),
    };
  },
);

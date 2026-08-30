"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUppyState } from "@uppy/react";
import { createQuestionUppy } from "./create-uppy";
import type { SignedUrlResponseObject } from "@/features/shared/storage-service";
import type { FileProgressState, UploadStatus } from "./upload.types";
import { env } from "@/config/env/client";

export function useQuestionUploader() {
  const [uppy] = useState(createQuestionUppy);

  const files = useUppyState(uppy, (state) => state.files);
  const totalProgress = useUppyState(uppy, (state) => state.totalProgress);
  const currentUploads = useUppyState(uppy, (state) => state.currentUploads);

  const findUppyFile = useCallback(
    (clientFileId: string) => {
      return uppy
        .getFiles()
        .find(
          (f) => f.meta?.clientFileId === clientFileId || f.id === clientFileId,
        );
    },
    [uppy],
  );

  const addFile = useCallback(
    (item: { clientFileId: string; file: File }) => {
      if (findUppyFile(item.clientFileId)) {
        return item.clientFileId;
      }

      try {
        const uppyFileId = uppy.addFile({
          id: item.clientFileId,
          name: item.file.name,
          type: item.file.type,
          data: item.file,
          meta: {
            clientFileId: item.clientFileId,
          },
        });
        return uppyFileId;
      } catch (error) {
        console.error("Failed to add file to question Uppy:", error);
        return null;
      }
    },
    [uppy, findUppyFile],
  );

  const removeFile = useCallback(
    (clientFileId: string) => {
      const file = findUppyFile(clientFileId);
      if (file) {
        uppy.removeFile(file.id);
      }
    },
    [uppy, findUppyFile],
  );

  const setCredentials = useCallback(
    (credentials: SignedUrlResponseObject[]) => {
      for (const cred of credentials) {
        const file = findUppyFile(cred.clientFileId);

        if (file) {
          uppy.setFileMeta(file.id, {
            bucketName: env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET_NAME,
            objectName: cred.storagePath,
            contentType: file.type || "image/jpeg",
            uploadToken: cred.token,
          });
        }
      }
    },
    [uppy, findUppyFile],
  );

  const upload = useCallback(async () => {
    return uppy.upload();
  }, [uppy]);

  const clear = useCallback(() => {
    uppy.cancelAll();
    const allFiles = uppy.getFiles();
    for (const f of allFiles) {
      uppy.removeFile(f.id);
    }
  }, [uppy]);

  const uploadStates = useMemo<Record<string, FileProgressState>>(() => {
    const states: Record<string, FileProgressState> = {};

    for (const file of Object.values(files)) {
      const clientFileId =
        (file.meta?.clientFileId as string) || file.id;

      const progress = file.progress;
      const percentage = progress?.percentage ?? 0;
      const bytesUploaded =
        typeof progress?.bytesUploaded === "number"
          ? progress.bytesUploaded
          : 0;
      const bytesTotal =
        typeof progress?.bytesTotal === "number"
          ? progress.bytesTotal
          : (file.size ?? 0);

      const isComplete = Boolean(progress?.uploadComplete);
      const isPaused = Boolean(
        progress?.uploadStarted &&
        !file.error &&
        !isComplete &&
        file.isPaused,
      );
      const hasError = Boolean(file.error);
      const isUploading = Boolean(
        progress?.uploadStarted && !isComplete && !isPaused && !hasError,
      );
      const hasCredentials = Boolean(file.meta?.uploadToken);

      let status: UploadStatus = "idle";

      if (isComplete) {
        status = "success";
      } else if (hasError) {
        status = "error";
      } else if (isPaused) {
        status = "paused";
      } else if (isUploading) {
        status = "uploading";
      } else if (hasCredentials) {
        status = "preparing";
      }

      states[clientFileId] = {
        clientFileId,
        status,
        percentage,
        bytesUploaded,
        bytesTotal,
        error: file.error ? String(file.error) : null,
        isPaused,
        isComplete,
      };
    }

    return states;
  }, [files]);

  useEffect(() => {
    return () => {
      uppy.cancelAll();
    };
  }, [uppy]);

  return {
    uppy,
    files,
    uploadStates,
    totalProgress,
    currentUploads,
    addFile,
    removeFile,
    setCredentials,
    upload,
    clear,
  };
}

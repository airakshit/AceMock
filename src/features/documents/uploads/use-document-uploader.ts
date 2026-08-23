"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUppyState } from "@uppy/react";
import { createDocumentUppy } from "./create-uppy";
import type { SignedUrlResponseObject } from "../storage-service";
import type { DocumentFileItem } from "../schemas";
import type { FileProgressState, UploadStatus } from "./upload.types";
import { env } from "@/config/env/client";

export function useDocumentUploader() {
    /**
     * IMPORTANT: Uppy must only be created once.
     */
    const [uppy] = useState(createDocumentUppy);

    /**
     * Reactive Uppy files.
     */
    const files = useUppyState(uppy, (state) => state.files);

    /**
     * Overall upload progress.
     */
    const totalProgress = useUppyState(uppy, (state) => state.totalProgress);

    /**
     * Currently running uploads.
     */
    const currentUploads = useUppyState(uppy, (state) => state.currentUploads);

    /**
     * Robustly find an Uppy file by matching clientFileId or internal ID.
     */
    const findUppyFile = useCallback(
        (clientFileId: string) => {
            return uppy
                .getFiles()
                .find(
                    (f) =>
                        f.meta?.clientFileId === clientFileId ||
                        f.id === clientFileId,
                );
        },
        [uppy],
    );

    /**
     * Add files to Uppy using clientFileId.
     */
    const addFiles = useCallback(
        (items: DocumentFileItem[]) => {
            if (items.length === 0) {
                return [];
            }

            const addedFileIds: string[] = [];

            for (const item of items) {
                // Prevent duplicate addition if file is already in Uppy
                if (findUppyFile(item.clientFileId)) {
                    addedFileIds.push(item.clientFileId);
                    continue;
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
                    addedFileIds.push(uppyFileId);
                } catch (error) {
                    console.error("Failed to add file to Uppy:", error);
                }
            }

            return addedFileIds;
        },
        [uppy, findUppyFile],
    );

    /**
     * Remove an Uppy file by clientFileId.
     */
    const removeFile = useCallback(
        (clientFileId: string) => {
            const file = findUppyFile(clientFileId);
            if (file) {
                uppy.removeFile(file.id);
            }
        },
        [uppy, findUppyFile],
    );

    /**
     * Pause upload for a specific file by clientFileId.
     */
    const pauseFile = useCallback(
        (clientFileId: string) => {
            const file = findUppyFile(clientFileId);
            if (file && !file.isPaused) {
                uppy.pauseResume(file.id);
            }
        },
        [uppy, findUppyFile],
    );

    /**
     * Resume upload for a specific file by clientFileId.
     */
    const resumeFile = useCallback(
        (clientFileId: string) => {
            const file = findUppyFile(clientFileId);
            if (file && file.isPaused) {
                uppy.pauseResume(file.id);
            }
        },
        [uppy, findUppyFile],
    );

    /**
     * Retry upload for a failed file by clientFileId.
     */
    const retryFile = useCallback(
        (clientFileId: string) => {
            const file = findUppyFile(clientFileId);
            if (file) {
                uppy.retryUpload(file.id);
            }
        },
        [uppy, findUppyFile],
    );

    /**
     * Cancel upload for a specific file.
     */
    const cancelFile = useCallback(
        (clientFileId: string) => {
            const file = findUppyFile(clientFileId);
            if (file) {
                uppy.removeFile(file.id);
            }
        },
        [uppy, findUppyFile],
    );

    /**
     * Pause all running uploads.
     */
    const pauseAll = useCallback(() => {
        uppy.pauseAll();
    }, [uppy]);

    /**
     * Resume all paused uploads.
     */
    const resumeAll = useCallback(() => {
        uppy.resumeAll();
    }, [uppy]);

    /**
     * Retry all failed uploads.
     */
    const retryAll = useCallback(() => {
        uppy.retryAll();
    }, [uppy]);

    /**
     * Remove all files & cancel running uploads.
     */
    const clear = useCallback(() => {
        uppy.cancelAll();
    }, [uppy]);

    /**
     * Get all Uppy files.
     */
    const getFiles = useCallback(() => {
        return uppy.getFiles();
    }, [uppy]);

    /**
     * Get a specific file by clientFileId.
     */
    const getFile = useCallback(
        (clientFileId: string) => {
            return findUppyFile(clientFileId);
        },
        [findUppyFile],
    );

    /**
     * Start upload process.
     */
    const upload = useCallback(async () => {
        return uppy.upload();
    }, [uppy]);

    /**
     * Attach server-signed credentials to Uppy files by clientFileId.
     */
    const setCredentials = useCallback(
        (credentialsList: SignedUrlResponseObject[]) => {
            for (const cred of credentialsList) {
                const file = findUppyFile(cred.clientFileId);
                if (!file) {
                    console.warn(
                        `Uppy file not found for clientFileId: ${cred.clientFileId}`,
                    );
                    continue;
                }

                uppy.setFileMeta(file.id, {
                    clientFileId: cred.clientFileId,
                    bucketName: env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET_NAME,
                    objectName: cred.storagePath,
                    contentType: file.type || "application/octet-stream",
                    uploadToken: cred.token,
                });
            }
        },
        [uppy, findUppyFile],
    );

    /**
     * Reactive progress map per clientFileId for UI synchronization.
     */
    const uploadStates = useMemo(() => {
        const stateMap: Record<string, FileProgressState> = {};
        for (const uppyFile of Object.values(files)) {
            const clientFileId =
                (uppyFile.meta?.clientFileId as string) || uppyFile.id;
            const progress = uppyFile.progress;
            const isComplete = Boolean(progress?.uploadComplete);
            const isStarted = Boolean(progress?.uploadStarted);
            const isPaused = Boolean(uppyFile.isPaused);
            const error = uppyFile.error ? String(uppyFile.error) : null;

            let status: UploadStatus = "idle";
            if (error) {
                status = "error";
            } else if (isComplete) {
                status = "success";
            } else if (isPaused) {
                status = "paused";
            } else if (isStarted) {
                status = "uploading";
            }

            stateMap[clientFileId] = {
                clientFileId,
                status,
                percentage:
                    typeof progress?.percentage === "number"
                        ? progress.percentage
                        : 0,
                bytesUploaded:
                    typeof progress?.bytesUploaded === "number"
                        ? progress.bytesUploaded
                        : 0,
                bytesTotal:
                    typeof progress?.bytesTotal === "number"
                        ? progress.bytesTotal
                        : uppyFile.size ?? 0,
                error,
                isPaused,
                isComplete,
            };
        }
        return stateMap;
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
        addFiles,
        removeFile,
        pauseFile,
        resumeFile,
        retryFile,
        cancelFile,
        pauseAll,
        resumeAll,
        retryAll,
        clear,
        getFiles,
        getFile,
        setCredentials,
        upload,
    };
}



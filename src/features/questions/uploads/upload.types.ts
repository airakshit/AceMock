import type { Meta, UppyFile } from "@uppy/core";

export interface QuestionUploadMeta extends Meta {
  clientFileId?: string;
  bucketName?: string;
  objectName?: string;
  contentType?: string;
  uploadToken?: string;
}

export type QuestionUppyFile = UppyFile<
  QuestionUploadMeta,
  Record<string, unknown>
>;

export type UploadStatus =
  | "idle"
  | "preparing"
  | "uploading"
  | "paused"
  | "success"
  | "error";

export interface FileProgressState {
  clientFileId: string;
  status: UploadStatus;
  percentage: number;
  bytesUploaded: number;
  bytesTotal: number;
  error: string | null;
  isPaused: boolean;
  isComplete: boolean;
}

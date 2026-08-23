import type { Meta, UppyFile } from "@uppy/core";

export interface DocumentUploadMeta extends Meta {
  /**
   * Your database document_file / client file ID.
   */
  clientFileId?: string;

  /**
   * Supabase Storage bucket.
   */
  bucketName?: string;

  /**
   * Supabase Storage object path.
   */
  objectName?: string;

  /**
   * MIME type.
   */
  contentType?: string;

  /**
   * Signed upload token.
   *
   * This is only kept in memory on the client.
   */
  uploadToken?: string;
}

export type DocumentUppyFile = UppyFile<
  DocumentUploadMeta,
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

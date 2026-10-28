import type { Meta, UppyFile } from "@uppy/core";

export interface DocumentUploadMeta extends Meta {
  /**
   * Your database document_file / client file ID.
   */
  clientFileId?: string;

  /**
   * document_files.id (server identity). Set together with the signed
   * credentials; the upload coordinator keys per-file completion and
   * progress on it.
   */
  serverFileId?: string;

  /**
   * Owning upload session ID.
   */
  sessionId?: string;

  /**
   * Owning document (set when credentials are attached) — the upload
   * runtime keys heartbeats, finalization and blob cleanup on this.
   */
  documentId?: string;

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
  Record<string, never>
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
  /**
   * document_files.id (server identity) — set once credentials are
   * attached. The document card joins live progress onto its server file
   * rows through this key.
   */
  serverFileId?: string;
  status: UploadStatus;
  percentage: number;
  bytesUploaded: number;
  bytesTotal: number;
  error: string | null;
  isPaused: boolean;
  isComplete: boolean;
}

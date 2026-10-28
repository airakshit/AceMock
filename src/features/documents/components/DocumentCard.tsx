"use client";

import { useState, useEffect } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DocumentFileDTO, DocumentItemDTO } from "../actions/types";
import { deleteDocumentAction } from "../actions/delete-document";
import { deleteDocumentFileAction } from "../actions/delete-document-file";
import { updateDocumentAction } from "../actions/update-document";
import { getDocumentFileAccessUrlAction } from "../actions/get-file-access-url";
import { processDocumentAction } from "../actions/process-document";
import { getUserDocumentAction } from "../actions/get-user-document";
import { formatBytes, formatDate } from "../utils";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { useDocumentUploaderContext } from "../uploads/document-uploader-provider";
import { UPLOAD_HEARTBEAT_STALE_MS } from "../uploads/upload-session-constants";
import {
  LIVE_RESUME_STATUS_VIEW,
  LIVE_UPLOAD_STATUS_VIEW,
  areAllFilesUploaded,
  resolveDocumentCardMode,
  resolveDocumentStatusView,
  summarizeFiles,
} from "./document-card-view";
import { DocumentFilesList } from "./DocumentFilesList";

interface DocumentCardProps {
  document: DocumentItemDTO;
  onDocumentDeleted?: (documentId: string) => void;
  onDocumentUpdated?: (updatedDoc: DocumentItemDTO) => void;
}

/**
 * DocumentCard — renders one document in exactly ONE of three explicit
 * modes (see `resolveDocumentCardMode` in document-card-view.ts):
 *
 * - `display`  — pure projection of the server DTO from
 *   get-user-documents. No live upload state exists in this tab for it.
 *   "Resume Upload" is offered only as an explicit ACTION (R2) when the
 *   session heartbeat has gone stale.
 * - `uploading` — THIS tab's coordinator owns the session (created here
 *   or resumed here): animated border, live overall/per-file progress and
 *   batch controls, status badge overridden by live truth.
 * - `resuming`  — a resume bootstrap is running for this document, or it
 *   is waiting for the user to re-select files (content-verified).
 *
 * Separation of concerns:
 * - mode + status resolution → document-card-view.ts (pure, no JSX)
 * - expanded files section (rows + live overlay + re-select rows)
 *   → DocumentFilesList.tsx
 * - this file: identity, actions, dialogs, mode wiring only.
 */
export function DocumentCard({
  document,
  onDocumentDeleted,
  onDocumentUpdated,
}: DocumentCardProps) {
  const {
    startResume,
    isResumeBusy,
    activeDocumentId,
    uploadStatesByServerFileId,
    totalProgress,
    pauseFile,
    resumeFile,
    retryFile,
    pauseAll,
    resumeAll,
    retryAll,
    resumeTarget,
    attachReselectedFile,
  } = useDocumentUploaderContext();

  const [isFilesOpen, setIsFilesOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isStartingResume, setIsStartingResume] = useState(false);

  /**
   * Staleness clock. `Date.now()` cannot be called during render (React
   * Compiler purity rules), so staleness is evaluated against this snapshot
   * that listens for wall-clock updates while the card is mounted.
   */
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    const update = () => setNowMs(Date.now());
    const initial = setTimeout(update, 400);
    const ticker = setInterval(update, 30_000);
    return () => {
      clearTimeout(initial);
      clearInterval(ticker);
    };
  }, []);

  // Editable fields
  const [title, setTitle] = useState(document.title);
  const [description, setDescription] = useState(document.description || "");

  // Processing & Files state
  const [processingStatus, setProcessingStatus] = useState(
    document.processingStatus || "pending",
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [files, setFiles] = useState<DocumentFileDTO[]>(document.files);

  // Update local state when parent prop changes
  useEffect(() => {
    setTitle(document.title);
    setDescription(document.description || "");
    setFiles(document.files);
    setProcessingStatus(document.processingStatus || "pending");
  }, [document]);

  // Loading & dialog states
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDocDialog, setShowDeleteDocDialog] = useState(false);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<DocumentFileDTO | null>(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);

  // File Preview state
  const [previewFile, setPreviewFile] = useState<DocumentFileDTO | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // -----------------------------------------------------------------------
  // Mode + status resolution — the pure logic lives in document-card-view.ts;
  // this block is the single wiring point (kept at the top so the rest of
  // the component can be read against one explicit `mode`).
  // -----------------------------------------------------------------------
  const mode = resolveDocumentCardMode({
    documentId: document.id,
    activeDocumentId,
    isResumingThisDocument:
      isStartingResume || resumeTarget?.documentId === document.id,
  });

  const isLiveMode = mode !== "display";

  /**
   * Badge: while THIS tab owns the session the live truth overrides the
   * (necessarily stale) server snapshot entirely; display mode resolves
   * from the server DTO.
   */
  const statusView =
    mode === "uploading"
      ? LIVE_UPLOAD_STATUS_VIEW
      : mode === "resuming"
        ? LIVE_RESUME_STATUS_VIEW
        : resolveDocumentStatusView({
            processingStatus,
            files,
            session: document.session,
            nowMs,
          });
  const StatusIcon = statusView.icon;

  const { pdfCount, imageCount, totalSize } = summarizeFiles(files);

  /**
   * Process is offered ONLY when every file's bytes are in storage — a
   * partially-uploaded document shows "Resume Upload" instead, never both
   * actions at once.
   */
  const canProcess = areAllFilesUploaded(files);

  /**
   * "Resume Upload" is offered whenever the (active) upload session is
   * stale — the heartbeat stopped, so the browser was closed mid-upload
   * and nothing re-opened the session since (requirement #2: resume ONLY
   * on this explicit click; brand-new uploads never touch this path).
   * Eligibility is still fully re-validated server-side by
   * resumeDocumentUploadAction's recovery algorithm.
   */
  const isResumePending =
    !isEditing &&
    document.session?.status === "active" &&
    nowMs > 0 &&
    files.some(
      (f) =>
        f.uploadStatus === "pending" ||
        f.uploadStatus === "uploading" ||
        f.uploadStatus === "failed",
    ) &&
    nowMs - new Date(document.session.lastHeartbeatAt).getTime() >
      UPLOAD_HEARTBEAT_STALE_MS;

  const handleRefreshStatus = async () => {
    try {
      setIsRefreshingStatus(true);
      const res = await getUserDocumentAction({ documentId: document.id });

      if (!res.success) {
        toast.error(res.error.message || "Failed to refresh document status");
        return;
      }

      setProcessingStatus(res.data.document.processingStatus);
      setFiles(res.data.document.files);
      onDocumentUpdated?.(res.data.document);
      toast.success("Document status refreshed");
    } catch (err) {
      toast.error("An unexpected error occurred while refreshing status");
      console.error(err);
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  const handleTriggerProcess = async () => {
    try {
      setIsProcessing(true);
      const res = await processDocumentAction({ documentId: document.id });

      if (!res.success) {
        toast.error(
          res.error.message || "Failed to trigger question extraction",
        );
        return;
      }

      toast.success("Question extraction started in background!");
      setProcessingStatus(res.data.document.processingStatus);
      onDocumentUpdated?.(res.data.document);
    } catch (err) {
      toast.error("An unexpected error occurred while starting processing");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartEdit = () => {
    setTitle(document.title);
    setDescription(document.description || "");
    setIsEditing(true);
    setIsFilesOpen(true); // Open files automatically in edit mode so files can be managed
  };

  /**
   * Manual resume of an interrupted upload — the ONLY path that re-opens
   * an abandoned session (requirement: resume strictly on explicit click).
   * The uploader provider hydrates the form above and continues the tus
   * transfers.
   */
  const handleResumeUpload = async () => {
    try {
      setIsStartingResume(true);
      await startResume(document.id);
    } catch (error) {
      toast.error("Failed to start the upload resume");
      console.error(error);
    } finally {
      setIsStartingResume(false);
    }
  };

  const isResumeDisabled = isResumeBusy || isStartingResume;

  const handleCancelEdit = () => {
    setTitle(document.title);
    setDescription(document.description || "");
    setIsEditing(false);
  };

  const handleSaveUpdate = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Document title cannot be empty");
      return;
    }

    try {
      setIsSaving(true);
      const res = await updateDocumentAction({
        documentId: document.id,
        title: trimmedTitle,
        description: description.trim() || undefined,
      });

      if (!res.success) {
        toast.error(res.error.message || "Failed to update document");
        return;
      }

      toast.success("Document updated successfully");
      setIsEditing(false);
      onDocumentUpdated?.(res.data.document);
    } catch (err) {
      toast.error("An unexpected error occurred while updating document");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDocument = async () => {
    try {
      setIsDeletingDoc(true);
      const res = await deleteDocumentAction({ documentId: document.id });

      if (!res.success) {
        toast.error(res.error.message || "Failed to delete document");
        return;
      }

      toast.success("Document and its files deleted successfully");
      setShowDeleteDocDialog(false);
      onDocumentDeleted?.(document.id);
    } catch (err) {
      toast.error("An unexpected error occurred while deleting document");
      console.error(err);
    } finally {
      setIsDeletingDoc(false);
    }
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;

    try {
      setIsDeletingFile(true);
      const res = await deleteDocumentFileAction({
        documentId: document.id,
        fileId: fileToDelete.id,
      });

      if (!res.success) {
        toast.error(res.error.message || "Failed to delete file");
        return;
      }

      toast.success(`"${fileToDelete.filename}" deleted successfully`);
      const updatedFiles = files.filter((f) => f.id !== fileToDelete.id);
      setFiles(updatedFiles);
      setFileToDelete(null);

      // Notify parent about file update
      onDocumentUpdated?.({
        ...document,
        files: updatedFiles,
      });
    } catch (err) {
      toast.error("An unexpected error occurred while deleting file");
      console.error(err);
    } finally {
      setIsDeletingFile(false);
    }
  };

  const handleViewFile = async (file: DocumentFileDTO) => {
    setPreviewFile(file);
    setPreviewUrl(null);
    setPreviewError(null);
    setIsLoadingPreview(true);
    setIsPreviewOpen(true);

    try {
      const res = await getDocumentFileAccessUrlAction({
        documentId: document.id,
        fileId: file.id,
      });

      if (!res.success) {
        const errorMsg = res.error.message || "Failed to generate file preview link.";
        setPreviewError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      setPreviewUrl(res.data.signedUrl);
    } catch (err) {
      console.error("Error fetching file preview URL:", err);
      const msg = "An unexpected error occurred while loading preview.";
      setPreviewError(msg);
      toast.error(msg);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "w-full overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-card transition-all",
          isEditing
            ? "border-brand/60 bg-card/95 ring-2 ring-brand/40"
            : "hover:border-brand/25 hover:shadow-card-hover",
          // Moving border beam while THIS tab uploads/resumes this doc.
          isLiveMode && "upload-beam-border",
        )}
      >
        {/* Main horizontal content row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between p-4 sm:p-5 gap-4">
          {/* Left section: Info, Title, Badges */}
          <div className="space-y-2.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Badge — live view while this tab uploads/resumes,
                  server-derived view in display mode */}
              <div className="inline-flex items-center gap-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium transition-all shadow-2xs",
                    statusView.className,
                  )}
                >
                  <StatusIcon
                    className={cn("size-3.5", statusView.spin && "animate-spin")}
                  />
                  <span>{statusView.label}</span>
                </span>
              </div>

              {isEditing && (
                <span className="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-brand/10 text-brand px-2 py-0.5 text-xs font-medium">
                  <Pencil className="size-3" />
                  <span>Editing Mode</span>
                </span>
              )}

              {/* Created Date */}
              <span className="text-xs text-muted-foreground ml-auto sm:ml-0">
                {formatDate(document.createdAt)}
              </span>
            </div>

            {/* Title & Description: Static vs Editable */}
            {isEditing ? (
              <div className="space-y-2 pt-1">
                <div>
                  <label
                    htmlFor={`title-${document.id}`}
                    className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1"
                  >
                    Document Title
                  </label>
                  <Input
                    id={`title-${document.id}`}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter document title"
                    className="font-medium text-sm h-9"
                    disabled={isSaving}
                    autoFocus
                  />
                </div>
                <div>
                  <label
                    htmlFor={`desc-${document.id}`}
                    className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1"
                  >
                    Description (optional)
                  </label>
                  <Textarea
                    id={`desc-${document.id}`}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide additional details or context"
                    rows={2}
                    className="text-xs resize-none"
                    disabled={isSaving}
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Title */}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <h4
                        className={cn(
                          typography.cardTitle,
                          "text-base sm:text-lg truncate cursor-default",
                        )}
                        title={document.title}
                      />
                    }
                  >
                    {document.title}
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    align="start"
                    className="max-w-sm wrap-break-word text-xs font-medium"
                  >
                    {document.title}
                  </TooltipContent>
                </Tooltip>

                {/* Description */}
                {document.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {document.description}
                  </p>
                )}
              </>
            )}

            {/* Files Summary */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs text-muted-foreground">
              {pdfCount > 0 && (
                <span className="inline-flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded-md">
                  <FileText className="size-3.5 text-danger" />
                  <span>
                    {pdfCount} {pdfCount === 1 ? "PDF" : "PDFs"}
                  </span>
                </span>
              )}

              {imageCount > 0 && (
                <span className="inline-flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded-md">
                  <ImageIcon className="size-3.5 text-info" />
                  <span>
                    {imageCount} {imageCount === 1 ? "Image" : "Images"}
                  </span>
                </span>
              )}

              {totalSize > 0 && (
                <span className="text-muted-foreground/80 font-mono text-[11px]">
                  {formatBytes(totalSize)}
                </span>
              )}

              {files.length === 0 && (
                <span className="text-muted-foreground text-xs italic">
                  No attached files
                </span>
              )}
            </div>
          </div>

          {/* Right section: Action Buttons */}
          <div className="flex flex-wrap items-center justify-start gap-1.5 border-t border-border/40 pt-3 sm:justify-end sm:border-t-0 sm:pt-0">
            {isResumePending && !isEditing && (
              <Button
                type="button"
                size="sm"
                onClick={handleResumeUpload}
                disabled={isResumeDisabled}
                className="h-8 px-3 text-xs gap-1.5 font-medium shadow-xs"
                title="Continue the interrupted upload from where it stopped"
              >
                {isStartingResume ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="size-3.5" />
                )}
                <span>Resume Upload</span>
              </Button>
            )}
            {isEditing ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="h-8 px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                  <span>Cancel</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveUpdate}
                  disabled={isSaving || !title.trim()}
                  className="h-8 px-3 text-xs gap-1.5"
                >
                  {isSaving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  <span>Save</span>
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Process / Extract Questions Button — only when every
                    file is uploaded; interrupted uploads show Resume
                    Upload instead (never both). */}
                {canProcess && (
                  <Button
                    type="button"
                    variant={
                      processingStatus === "failed"
                        ? "destructive"
                        : processingStatus === "completed"
                          ? "outline"
                          : "default"
                    }
                    size="sm"
                    onClick={handleTriggerProcess}
                    disabled={
                      isProcessing ||
                      processingStatus === "processing_files" ||
                      processingStatus === "extracting_questions" ||
                      processingStatus === "merging_questions"
                    }
                    className={cn(
                      "h-8 px-2.5 sm:px-3 text-xs gap-1.5 font-medium transition-all shadow-xs",
                      processingStatus === "pending" &&
                      "bg-brand hover:bg-brand/90 text-primary-foreground",
                      processingStatus === "completed" &&
                      "border-success/30 text-success hover:bg-success/10",
                    )}
                    title="Trigger question extraction"
                  >
                    {isProcessing ||
                    processingStatus === "processing_files" ||
                    processingStatus === "extracting_questions" ||
                    processingStatus === "merging_questions" ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>
                          {processingStatus === "processing_files"
                            ? "Processing..."
                            : processingStatus === "extracting_questions"
                              ? "Extracting..."
                              : processingStatus === "merging_questions"
                                ? "Merging..."
                                : "Working..."}
                        </span>
                      </>
                    ) : processingStatus === "completed" ? (
                      <span>Re-process</span>
                    ) : processingStatus === "failed" ? (
                      <span>Retry</span>
                    ) : (
                      <span>Process</span>
                    )}
                  </Button>
                )}

                {/* Edit Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleStartEdit}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Edit document details"
                >
                  <Pencil className="size-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>

                {/* Delete Document Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteDocDialog(true)}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete document"
                >
                  <Trash2 className="size-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>

                {/* Document-level Refresh Button — re-fetches this document
                    with the same DTO the list uses (getUserDocumentAction). */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshStatus}
                  disabled={isRefreshingStatus}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Refresh document status and files"
                >
                  <RefreshCw
                    className={cn(
                      "size-3.5",
                      isRefreshingStatus && "animate-spin text-brand",
                    )}
                  />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>

                {/* View/Hide Files Toggle — hidden while this tab uploads or
                    resumes: the section stays pinned open so live progress
                    is always visible. */}
                {files.length > 0 && !isLiveMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFilesOpen(!isFilesOpen)}
                    className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground ml-1"
                  >
                    <span>{isFilesOpen ? "Hide files" : "View files"}</span>
                    {isFilesOpen ? (
                      <ChevronUp className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expandable Files List — pinned open while this tab uploads or
            resumes so live progress stays visible. All row rendering
            (pure + live overlay + re-select rows) lives in
            DocumentFilesList. */}
        {(isFilesOpen || isLiveMode) && files.length > 0 && (
          <div className="border-t border-border/50 bg-muted/20 p-4">
            <DocumentFilesList
              documentId={document.id}
              files={files}
              isEditing={isEditing}
              mode={mode}
              onViewFile={handleViewFile}
              onDeleteFile={setFileToDelete}
              live={
                isLiveMode
                  ? {
                      statesByServerFileId: uploadStatesByServerFileId,
                      totalProgress,
                      resumeTarget,
                      onPauseAll: pauseAll,
                      onResumeAll: resumeAll,
                      onRetryAll: retryAll,
                      onPauseFile: pauseFile,
                      onResumeFile: resumeFile,
                      onRetryFile: retryFile,
                      onAttachReselectedFile: attachReselectedFile,
                    }
                  : undefined
              }
            />
          </div>
        )}
      </div>

      {/* Confirmation Dialog: Delete Document */}
      <ConfirmDeleteDialog
        open={showDeleteDocDialog}
        onOpenChange={setShowDeleteDocDialog}
        title="Delete Document"
        description={`Are you sure you want to delete "${document.title}"? This will permanently remove the document, its ${files.length} attached file(s), and all extracted pages from storage. This action cannot be undone.`}
        confirmLabel="Delete Document"
        isDeleting={isDeletingDoc}
        onConfirm={handleDeleteDocument}
      />

      {/* Confirmation Dialog: Delete File */}
      <ConfirmDeleteDialog
        open={fileToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletingFile) {
            setFileToDelete(null);
          }
        }}
        title="Delete File"
        description={`Are you sure you want to delete "${fileToDelete?.filename}"? This will permanently remove this file and all its processed page records from storage.`}
        confirmLabel="Delete File"
        isDeleting={isDeletingFile}
        onConfirm={handleDeleteFile}
      />

      {/* File Preview Dialog */}
      {previewFile && (
        <FilePreviewDialog
          open={isPreviewOpen}
          onOpenChange={setIsPreviewOpen}
          filename={previewFile.filename}
          mimeType={previewFile.mimeType}
          fileSize={previewFile.fileSize}
          url={previewUrl}
          isLoading={isLoadingPreview}
          error={previewError}
        />
      )}
    </>
  );
}
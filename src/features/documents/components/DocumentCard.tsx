"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { colors, motion, typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import type { DocumentFileDTO, DocumentItemDTO } from "../actions/types";
import { deleteDocumentAction } from "../actions/delete-document";
import { deleteDocumentFileAction } from "../actions/delete-document-file";
import { updateDocumentAction } from "../actions/update-document";
import { getDocumentFileAccessUrlAction } from "../actions/get-file-access-url";
import { formatBytes, formatDate } from "../utils";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { FilePreviewDialog } from "./FilePreviewDialog";

interface DocumentCardProps {
  document: DocumentItemDTO;
  onDocumentDeleted?: (documentId: string) => void;
  onDocumentUpdated?: (updatedDoc: DocumentItemDTO) => void;
}

export function DocumentCard({
  document,
  onDocumentDeleted,
  onDocumentUpdated,
}: DocumentCardProps) {
  const [isFilesOpen, setIsFilesOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Editable fields
  const [title, setTitle] = useState(document.title);
  const [description, setDescription] = useState(document.description || "");

  // Files state (local representation for immediate UI reactivity)
  const [files, setFiles] = useState<DocumentFileDTO[]>(document.files);

  // Update local state when parent prop changes
  useEffect(() => {
    setTitle(document.title);
    setDescription(document.description || "");
    setFiles(document.files);
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
  const totalSize = files.reduce(
    (acc, f) => acc + (f.fileSize || 0),
    0,
  );

  const getDocumentStatus = () => {
    if (files.length === 0) {
      return {
        label: "Uploaded",
        icon: CheckCircle2,
        className: colors.status.uploaded.badge,
        dot: colors.status.uploaded.dot,
        spin: false,
      };
    }
    const hasUploading = files.some(
      (f) => f.uploadStatus === "uploading",
    );
    const hasFailed = files.some((f) => f.uploadStatus === "failed");

    if (hasUploading) {
      return {
        label: "Uploading",
        icon: Loader2,
        className: colors.status.uploading.badge,
        dot: colors.status.uploading.dot,
        spin: true,
      };
    }
    if (hasFailed) {
      return {
        label: "Failed",
        icon: AlertTriangle,
        className: colors.status.failed.badge,
        dot: colors.status.failed.dot,
        spin: false,
      };
    }
    return {
      label: "Uploaded",
      icon: CheckCircle2,
      className: colors.status.uploaded.badge,
      dot: colors.status.uploaded.dot,
      spin: false,
    };
  };

  const statusInfo = getDocumentStatus();
  const StatusIcon = statusInfo.icon;

  const handleStartEdit = () => {
    setTitle(document.title);
    setDescription(document.description || "");
    setIsEditing(true);
    setIsFilesOpen(true); // Open files automatically in edit mode so files can be managed
  };

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

      if (!res.success || !res.data) {
        toast.error(res.message || "Failed to update document");
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
        toast.error(res.message || "Failed to delete document");
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
        toast.error(res.message || "Failed to delete file");
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

      if (!res.success || !res.data) {
        const errorMsg = res.message || "Failed to generate file preview link.";
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
          "w-full rounded-xl border border-border/80 bg-card text-card-foreground shadow-xs overflow-hidden transition-all",
          isEditing
            ? "ring-2 ring-brand/40 border-brand/60 bg-card/95"
            : motion.cardHover,
        )}
      >
        {/* Main horizontal content row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between p-4 sm:p-5 gap-4">
          {/* Left section: Info, Title, Badges */}
          <div className="space-y-2.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Badge with semantic colors */}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium",
                  statusInfo.className,
                )}
              >
                <StatusIcon
                  className={cn("size-3.5", statusInfo.spin && "animate-spin")}
                />
                <span>{statusInfo.label}</span>
              </span>

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
                <h4
                  className={cn(
                    typography.cardTitle,
                    "text-base sm:text-lg truncate",
                  )}
                >
                  {document.title}
                </h4>

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
                  <FileText className="size-3.5 text-rose-500" />
                  <span>
                    {pdfCount} {pdfCount === 1 ? "PDF" : "PDFs"}
                  </span>
                </span>
              )}

              {imageCount > 0 && (
                <span className="inline-flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded-md">
                  <ImageIcon className="size-3.5 text-sky-500" />
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
          <div className="flex items-center justify-end shrink-0 gap-1.5 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/40">
            {isEditing ? (
              <div className="flex items-center gap-1.5">
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
              <div className="flex items-center gap-1">
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

                {/* View/Hide Files Toggle */}
                {files.length > 0 && (
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

        {/* Expandable Files List */}
        {isFilesOpen && files.length > 0 && (
          <div className="border-t border-border/50 bg-muted/20 p-4 space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Attached Files ({files.length})
              </p>
              {isEditing && (
                <p className="text-[11px] text-muted-foreground/80 italic">
                  Click the delete icon on any file to remove it
                </p>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {files.map((file) => {
                const isPdf =
                  file.mimeType === "application/pdf" ||
                  file.filename.toLowerCase().endsWith(".pdf");
                const FileIcon = isPdf ? FileText : ImageIcon;

                return (
                  <div
                    key={file.id}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card p-2.5 text-xs transition-colors hover:bg-muted/40",
                      isEditing && "border-dashed",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex size-7 items-center justify-center rounded-md border border-border/50 bg-background shrink-0">
                        <FileIcon
                          className={cn(
                            "size-3.5",
                            isPdf ? "text-rose-500" : "text-sky-500",
                          )}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate max-w-36 sm:max-w-48">
                          {file.filename}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {formatBytes(file.fileSize)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* File status badge */}
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase border",
                          file.uploadStatus === "uploaded"
                            ? colors.status.uploaded.badge
                            : file.uploadStatus === "uploading"
                              ? colors.status.uploading.badge
                              : colors.status.failed.badge,
                        )}
                      >
                        {file.uploadStatus}
                      </span>

                      {/* View / Preview File Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewFile(file)}
                        disabled={file.uploadStatus !== "uploaded"}
                        className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title={
                          file.uploadStatus === "uploaded"
                            ? `Preview "${file.filename}"`
                            : "Preview unavailable until file finishes uploading"
                        }
                      >
                        <Eye className="size-3.5" />
                        <span className="sr-only">Preview file</span>
                      </Button>

                      {/* Delete File Button in Edit Mode */}
                      {isEditing && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setFileToDelete(file)}
                          className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title={`Delete "${file.filename}"`}
                        >
                          <Trash2 className="size-3.5" />
                          <span className="sr-only">Delete file</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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

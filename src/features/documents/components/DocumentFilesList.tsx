"use client";

import {
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { colors } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import type { DocumentFileDTO } from "../actions/types";
import { formatBytes } from "../utils";
import type { FileProgressState } from "../uploads/upload.types";
import type {
  DocumentCardMode,
  LiveFileBadgeEntry,
} from "./document-card-view";
import {
  clientFacingFileStatus,
  LIVE_FILE_BADGE as LIVE_BADGES,
} from "./document-card-view";
import type { ResumableFileView, ResumeTarget } from "../uploads/document-uploader-provider";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Everything needed to sync the file list with the LIVE upload running in
 * this tab. The list renders pure server rows without it (display mode);
 * with it, per-file progress, live badges and batch controls are joined
 * onto those same rows by serverFileId.
 */
export interface DocumentFilesListLiveProps {
  /** Live Uppy states keyed by document_files.id. */
  statesByServerFileId: Record<string, FileProgressState>;
  /** Overall Uppy batch progress (0–100). */
  totalProgress: number;
  /** Non-null while a resumed session waits for re-selections. */
  resumeTarget: ResumeTarget | null;
  onPauseAll: () => void;
  onResumeAll: () => void;
  onRetryAll: () => void;
  onPauseFile: (clientFileId: string) => void;
  onResumeFile: (clientFileId: string) => void;
  onRetryFile: (clientFileId: string) => void;
  onAttachReselectedFile: (view: ResumableFileView, file: File) => void;
}

interface DocumentFilesListProps {
  documentId: string;
  files: DocumentFileDTO[];
  isEditing: boolean;
  mode: DocumentCardMode;
  /** Present only in uploading/resuming modes (this tab owns the session). */
  live?: DocumentFilesListLiveProps;
  onViewFile: (file: DocumentFileDTO) => void;
  onDeleteFile: (file: DocumentFileDTO) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * The card's expandable files section. Display rendering is a pure
 * projection of the server DTO; live upload state — overall progress,
 * per-file bars, pause/resume/retry controls, re-select rows — is layered
 * on top ONLY in the uploading/resuming modes, so each row always shows
 * the server record plus (optionally) the live truth for that same file.
 */
export function DocumentFilesList({
  documentId,
  files,
  isEditing,
  mode,
  live,
  onViewFile,
  onDeleteFile,
}: DocumentFilesListProps) {
  const isLive = mode !== "display" && live !== undefined;

  // Batch-level flags, derived from LIVE states only — the server DTO's
  // uploadStatus lags behind during an active transfer.
  const liveStates =
    isLive && live ? Object.values(live.statesByServerFileId) : [];
  const anyActive = liveStates.some(
    (s) => s.status === "uploading" || s.status === "preparing",
  );
  const anyPaused = liveStates.some((s) => s.status === "paused");
  const anyFailed = liveStates.some((s) => s.status === "error");

  // Re-select rows: only while THIS document's resume is waiting for them.
  const reselectViews =
    isLive && live && live.resumeTarget?.documentId === documentId
      ? live.resumeTarget.filesNeedingReselect
      : [];

  return (
    <div className="space-y-2.5">
      {/* Section header */}
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

      {/* Live batch panel — overall progress + batch controls */}
      {isLive && mode === "uploading" && live && (
        <div className="rounded-lg border border-info/25 bg-info/5 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-info">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Uploading — {Math.round(live.totalProgress)}%</span>
            </div>

            <div className="flex items-center gap-1">
              {anyActive && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={live.onPauseAll}
                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <Pause className="size-3" />
                  Pause all
                </Button>
              )}
              {anyPaused && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={live.onResumeAll}
                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <Play className="size-3" />
                  Resume all
                </Button>
              )}
              {anyFailed && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={live.onRetryAll}
                  className="h-7 px-2 text-[11px] text-danger hover:text-danger"
                >
                  <RotateCcw className="size-3" />
                  Retry all
                </Button>
              )}
            </div>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-[width]"
              style={{ width: `${Math.round(live.totalProgress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Re-select rows — resume can restore bytes only from persisted FS
          handles; anything else needs the exact original file again, and
          the content probe verifies it before the upload continues. */}
      {reselectViews.length > 0 && live && (
        <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-3">
          <p className="text-[11px] font-medium text-warning">
            {reselectViews.length} file(s) must be re-selected to continue —
            content is verified against the original before resuming.
          </p>

          {reselectViews.map((view) => (
            <ReselectRow
              key={view.serverFileId}
              view={view}
              onAttach={(file) => live.onAttachReselectedFile(view, file)}
            />
          ))}
        </div>
      )}

      {/* File grid */}
      <div className="grid gap-2 sm:grid-cols-2">
        {files.map((file) => (
          <FileRow
            key={file.id}
            file={file}
            isEditing={isEditing}
            liveState={isLive && live ? live.statesByServerFileId[file.id] : undefined}
            onViewFile={onViewFile}
            onDeleteFile={onDeleteFile}
            onPauseFile={live?.onPauseFile}
            onResumeFile={live?.onResumeFile}
            onRetryFile={live?.onRetryFile}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Re-select row
// ---------------------------------------------------------------------------

function ReselectRow({
  view,
  onAttach,
}: {
  view: ResumableFileView;
  onAttach: (file: File) => void;
}) {
  const isPdf =
    view.mimeType === "application/pdf" ||
    view.filename.toLowerCase().endsWith(".pdf");
  const FileIcon = isPdf ? FileText : ImageIcon;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-warning/30 bg-card p-2.5 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex size-7 items-center justify-center rounded-md border border-border/50 bg-background shrink-0">
          <FileIcon
            className={cn("size-3.5", isPdf ? "text-danger" : "text-info")}
          />
        </div>
        <div className="min-w-0">
          <p
            className="font-medium text-foreground truncate max-w-36 sm:max-w-48"
            title={view.filename}
          >
            {view.filename}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono">
            {formatBytes(view.fileSize)}
          </p>
        </div>
      </div>

      <label
        className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border/60 bg-background px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
        title="Select the original file — its content is verified before the upload continues"
      >
        <UploadCloud className="size-3.5 text-brand" />
        Choose file
        <input
          type="file"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Reset so picking the SAME file again re-fires onChange.
            event.target.value = "";
            if (file) onAttach(file);
          }}
        />
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// File row — server DTO + optional live overlay
// ---------------------------------------------------------------------------

interface FileRowProps {
  file: DocumentFileDTO;
  isEditing: boolean;
  /** Live Uppy state for this exact file (undefined outside live modes). */
  liveState?: FileProgressState;
  onViewFile: (file: DocumentFileDTO) => void;
  onDeleteFile: (file: DocumentFileDTO) => void;
  onPauseFile?: (clientFileId: string) => void;
  onResumeFile?: (clientFileId: string) => void;
  onRetryFile?: (clientFileId: string) => void;
}

function FileRow({
  file,
  isEditing,
  liveState,
  onViewFile,
  onDeleteFile,
  onPauseFile,
  onResumeFile,
  onRetryFile,
}: FileRowProps) {
  const isPdf =
    file.mimeType === "application/pdf" ||
    file.filename.toLowerCase().endsWith(".pdf");
  const FileIcon = isPdf ? FileText : ImageIcon;

  /**
   * Badge + preview gate. Live truth wins while this tab owns the
   * transfer: a live "success" flips the row to Uploaded instantly,
   * without waiting for the next server snapshot.
   */
  const liveBadge =
    liveState && !liveState.isComplete
      ? LIVE_BADGES[liveState.status]
      : liveState?.isComplete
        ? LIVE_BADGES.success
        : undefined;
  const serverStatus = clientFacingFileStatus(file.uploadStatus);
  const badge: LiveFileBadgeEntry = liveBadge ?? {
    label: serverStatus,
    className: colors.status[serverStatus].badge,
  };

  const canPreview = serverStatus === "uploaded" || Boolean(liveState?.isComplete);

  // Per-file live control — exactly one, driven by the live state.
  const liveControl =
    liveState && !liveState.isComplete
      ? liveState.status === "error"
        ? { icon: RotateCcw, label: "Retry", action: onRetryFile }
        : liveState.status === "paused"
          ? { icon: Play, label: "Resume", action: onResumeFile }
          : liveState.status === "uploading" || liveState.status === "preparing"
            ? { icon: Pause, label: "Pause", action: onPauseFile }
            : null
      : null;

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-card p-2.5 text-xs transition-colors hover:bg-muted/40",
        isEditing && "border-dashed",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-7 items-center justify-center rounded-md border border-border/50 bg-background shrink-0">
            <FileIcon
              className={cn("size-3.5", isPdf ? "text-danger" : "text-info")}
            />
          </div>
          <div className="min-w-0">
            <Tooltip>
              <TooltipTrigger
                render={
                  <p
                    className="font-medium text-foreground truncate max-w-36 sm:max-w-48 cursor-default"
                    title={file.filename}
                  />
                }
              >
                {file.filename}
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="start"
                className="max-w-xs sm:max-w-sm break-all text-xs font-medium"
              >
                {file.filename}
              </TooltipContent>
            </Tooltip>
            <p className="text-[10px] text-muted-foreground font-mono">
              {formatBytes(file.fileSize)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Status badge — live while transferring, server otherwise. */}
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase border",
              badge.className,
            )}
          >
            {badge.label}
          </span>

          {/* Live per-file control (pause / resume / retry). */}
          {liveControl && liveState && liveControl.action && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => liveControl.action!(liveState.clientFileId)}
              className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={`${liveControl.label} "${file.filename}"`}
            >
              <liveControl.icon className="size-3.5" />
              <span className="sr-only">{liveControl.label} file</span>
            </Button>
          )}

          {/* View / Preview File Button — available once the bytes are in
              storage (server status uploaded, or the live batch reports
              this file complete). */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onViewFile(file)}
            disabled={!canPreview}
            className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={
              canPreview
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
              onClick={() => onDeleteFile(file)}
              className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title={`Delete "${file.filename}"`}
            >
              <Trash2 className="size-3.5" />
              <span className="sr-only">Delete file</span>
            </Button>
          )}
        </div>
      </div>

      {/* Live progress bar — only while this file is actively transferring. */}
      {liveState && !liveState.isComplete && liveState.status !== "error" && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              liveState.status === "paused" ? "bg-warning" : "bg-brand",
            )}
            style={{ width: `${Math.round(liveState.percentage)}%` }}
          />
        </div>
      )}
    </div>
  );
}

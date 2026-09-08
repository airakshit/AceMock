"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { colors, motion, typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import type { DocumentItemDTO } from "../actions/types";
import { formatBytes, formatDate } from "../utils";

interface DocumentCardProps {
  document: DocumentItemDTO;
}

export function DocumentCard({ document }: DocumentCardProps) {
  const [isFilesOpen, setIsFilesOpen] = useState(false);

  const pdfCount = document.files.filter(
    (f) =>
      f.mimeType === "application/pdf" ||
      f.filename.toLowerCase().endsWith(".pdf"),
  ).length;
  const imageCount = document.files.filter(
    (f) =>
      f.mimeType.startsWith("image/") ||
      (!f.mimeType.includes("pdf") &&
        !f.filename.toLowerCase().endsWith(".pdf")),
  ).length;
  const totalSize = document.files.reduce(
    (acc, f) => acc + (f.fileSize || 0),
    0,
  );

  const getDocumentStatus = () => {
    if (document.files.length === 0) {
      return {
        label: "Uploaded",
        icon: CheckCircle2,
        className: colors.status.uploaded.badge,
        dot: colors.status.uploaded.dot,
        spin: false,
      };
    }
    const hasUploading = document.files.some(
      (f) => f.uploadStatus === "uploading",
    );
    const hasFailed = document.files.some((f) => f.uploadStatus === "failed");

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

  return (
    <div
      className={cn(
        "w-full rounded-xl border border-border/80 bg-card text-card-foreground shadow-xs overflow-hidden",
        motion.cardHover,
      )}
    >
      {/* Main horizontal content row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-4">
        {/* Left section: Info, Title, Badges */}
        <div className="space-y-2 min-w-0 flex-1">
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

            {/* Created Date */}
            <span className="text-xs text-muted-foreground ml-auto sm:ml-0">
              {formatDate(document.createdAt)}
            </span>
          </div>

          {/* Title */}
          <h4 className={cn(typography.cardTitle, "text-base sm:text-lg truncate")}>
            {document.title}
          </h4>

          {/* Description */}
          {document.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {document.description}
            </p>
          )}

          {/* Files Summary */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs text-muted-foreground">
            {pdfCount > 0 && (
              <span className="inline-flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded-md">
                <FileText className="size-3.5 text-rose-500" />
                <span>{pdfCount} {pdfCount === 1 ? "PDF" : "PDFs"}</span>
              </span>
            )}

            {imageCount > 0 && (
              <span className="inline-flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded-md">
                <ImageIcon className="size-3.5 text-sky-500" />
                <span>{imageCount} {imageCount === 1 ? "Image" : "Images"}</span>
              </span>
            )}

            {totalSize > 0 && (
              <span className="text-muted-foreground/80 font-mono text-[11px]">
                {formatBytes(totalSize)}
              </span>
            )}
          </div>
        </div>

        {/* Right section: Action toggle */}
        {document.files.length > 0 && (
          <div className="flex items-center justify-between sm:justify-end shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/40">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsFilesOpen(!isFilesOpen)}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <span>{isFilesOpen ? "Hide files" : "View files"}</span>
              {isFilesOpen ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Expandable Files List */}
      {isFilesOpen && document.files.length > 0 && (
        <div className="border-t border-border/50 bg-muted/20 p-4 space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Attached Files ({document.files.length})
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {document.files.map((file) => {
              const isPdf =
                file.mimeType === "application/pdf" ||
                file.filename.toLowerCase().endsWith(".pdf");
              const FileIcon = isPdf ? FileText : ImageIcon;

              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card p-2.5 text-xs transition-colors hover:bg-muted/40"
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
                      <p className="font-medium text-foreground truncate max-w-44 sm:max-w-56">
                        {file.filename}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {formatBytes(file.fileSize)}
                      </p>
                    </div>
                  </div>

                  {/* File status badge */}
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase border",
                      file.uploadStatus === "uploaded"
                        ? colors.status.uploaded.badge
                        : file.uploadStatus === "uploading"
                          ? colors.status.uploading.badge
                          : colors.status.failed.badge,
                    )}
                  >
                    {file.uploadStatus}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

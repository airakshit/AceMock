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
        className:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800",
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
        className:
          "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800",
        spin: true,
      };
    }
    if (hasFailed) {
      return {
        label: "Failed",
        icon: AlertTriangle,
        className:
          "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800",
        spin: false,
      };
    }
    return {
      label: "Uploaded",
      icon: CheckCircle2,
      className:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800",
      spin: false,
    };
  };

  const statusInfo = getDocumentStatus();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="w-full rounded-xl border bg-card text-card-foreground shadow-2xs hover:border-primary/30 transition-all duration-200 overflow-hidden">
      {/* Main horizontal content row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-4">
        {/* Left section: Info, Title, Badges */}
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Badge with custom colors */}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors",
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
          <h4 className="text-base sm:text-lg font-bold text-foreground truncate tracking-tight">
            {document.title}
          </h4>

          {/* Description */}
          {document.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {document.description}
            </p>
          )}

          {/* Files Summary */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground font-mono">
            {pdfCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3.5 text-rose-500" />
                {pdfCount} {pdfCount === 1 ? "PDF" : "PDFs"}
              </span>
            )}

            {imageCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <ImageIcon className="size-3.5 text-blue-500" />
                {imageCount} {imageCount === 1 ? "Image" : "Images"}
              </span>
            )}

            {totalSize > 0 && (
              <span className="text-muted-foreground/70">
                Total: {formatBytes(totalSize)}
              </span>
            )}
          </div>
        </div>

        {/* Right section: Action toggle */}
        {document.files.length > 0 && (
          <div className="flex items-center justify-between sm:justify-end shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsFilesOpen(!isFilesOpen)}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <span>{isFilesOpen ? "Hide Files" : "View Files"}</span>
              {isFilesOpen ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Expandable Files List */}
      {isFilesOpen && document.files.length > 0 && (
        <div className="border-t bg-muted/30 p-3 sm:p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
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
                  className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2.5 text-xs transition-colors hover:bg-card/80"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex size-7 items-center justify-center rounded-md border bg-background shrink-0">
                      <FileIcon
                        className={cn(
                          "size-3.5",
                          isPdf ? "text-rose-500" : "text-blue-500",
                        )}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate max-w-45 sm:max-w-55">
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
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase font-mono",
                      file.uploadStatus === "uploaded"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                        : file.uploadStatus === "uploading"
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400",
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

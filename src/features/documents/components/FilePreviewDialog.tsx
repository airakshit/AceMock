"use client";

import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatBytes } from "../utils";
import { cn } from "@/lib/utils";

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filename: string;
  mimeType: string;
  fileSize?: number;
  url: string | null;
  isLoading: boolean;
  error?: string | null;
}

export function FilePreviewDialog({
  open,
  onOpenChange,
  filename,
  mimeType,
  fileSize,
  url,
  isLoading,
  error,
}: FilePreviewDialogProps) {
  const isPdf =
    mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf");
  const isImage =
    mimeType.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(filename);
  const FileIcon = isPdf ? FileText : isImage ? ImageIcon : FileText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] sm:max-w-4xl md:max-w-5xl h-[88vh] p-0 flex flex-col gap-0 overflow-hidden bg-background">
        {/* Header */}
        <DialogHeader className="p-4 sm:px-6 py-3.5 border-b border-border/80 flex flex-row items-center justify-between gap-3 shrink-0 bg-card/60">
          <div className="flex items-center gap-3 min-w-0 pr-8">
            <div className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-muted/50 shrink-0">
              <FileIcon
                className={cn(
                  "size-4",
                  isPdf
                    ? "text-danger"
                    : isImage
                      ? "text-info"
                      : "text-muted-foreground",
                )}
              />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm sm:text-base font-semibold text-foreground truncate max-w-xs sm:max-w-md md:max-w-lg">
                {filename}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                {fileSize ? <span>{formatBytes(fileSize)}</span> : null}
                {fileSize ? <span>•</span> : null}
                <span className="uppercase font-mono text-[10px] bg-muted/80 px-1.5 py-0.2 rounded border border-border/40">
                  {isPdf ? "PDF Document" : isImage ? "Image" : mimeType}
                </span>
              </DialogDescription>
            </div>
          </div>

          {url && !isLoading && (
            <div className="flex items-center gap-1.5 shrink-0 mr-8">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open file in a new tab"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-8 px-2.5 gap-1.5 text-xs text-muted-foreground hover:text-foreground inline-flex items-center flex-row",
                )}
              >
                <ExternalLink className="size-3.5 shrink-0" />
                <span>Open in tab</span>
              </a>
            </div>
          )}
        </DialogHeader>

        {/* Content Viewer Body */}
        <div className="flex-1 w-full bg-muted/15 relative overflow-hidden flex items-center justify-center">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
              <Loader2 className="size-8 animate-spin text-brand" />
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                Loading...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center max-w-sm">
              <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="size-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Unable to load preview
              </p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          ) : !url ? (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
              <p className="text-sm">No preview URL available.</p>
            </div>
          ) : isPdf ? (
            <iframe
              src={url}
              className="w-full h-full border-0 bg-white dark:bg-zinc-900"
              title={`Preview of ${filename}`}
            />
          ) : isImage ? (
            <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={filename}
                className="max-h-full max-w-full object-contain rounded-md shadow-sm border border-border/40"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                Inline preview is not supported for this file format.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "gap-1.5 text-xs inline-flex items-center flex-row",
                )}
              >
                <ExternalLink className="size-3.5 shrink-0" />
                <span>Open in new window</span>
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import {
  CheckCircle2,
  CircleAlert,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import type Uppy from "@uppy/core";
import { useUppyState } from "@uppy/react";
import { Button } from "@/components/ui/button";
import type { DocumentUploadMeta } from "../uploads/upload.types";
import { formatBytes } from "../utils";

interface FileUploadItemProps {
  clientFileId: string;
  uppy: Uppy<DocumentUploadMeta>;
  onRemove: () => void;
}

export function FileUploadItem({
  clientFileId,
  uppy,
  onRemove,
}: FileUploadItemProps) {
  const uppyFile = useUppyState(uppy, (state) => state.files[clientFileId]);

  if (!uppyFile) {
    return null;
  }

  const progress = uppyFile.progress;
  const percentage = progress?.percentage ?? 0;
  const fileSize = uppyFile.size ?? 0;
  const isUploading = Boolean(
    progress?.uploadStarted && !progress?.uploadComplete,
  );
  const isComplete = Boolean(progress?.uploadComplete);
  const isPaused = Boolean(
    progress?.uploadStarted &&
    uppyFile.error === null &&
    !isComplete &&
    uppyFile.isPaused,
  );
  const hasError = Boolean(uppyFile.error);

  const handlePauseResume = () => {
    uppy.pauseResume(clientFileId);
  };

  const handleRetry = () => {
    uppy.retryUpload(clientFileId);
  };

  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{uppyFile.name}</p>

          <p className="text-xs text-muted-foreground font-mono">
            {formatBytes(fileSize)}
            {isUploading && ` • ${percentage}%`}
          </p>
        </div>

        {isComplete && (
          <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
        )}

        {hasError && (
          <CircleAlert className="size-4 shrink-0 text-destructive" />
        )}

        {!isComplete && !hasError && progress?.uploadStarted && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handlePauseResume}
          >
            {isPaused ? (
              <Play className="size-4 text-primary" />
            ) : (
              <Pause className="size-4 text-muted-foreground" />
            )}
          </Button>
        )}

        {hasError && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRetry}
          >
            <RotateCcw className="size-4 text-destructive" />
          </Button>
        )}

        {!isComplete && (
          <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
            <X className="size-4 text-muted-foreground" />
          </Button>
        )}
      </div>

      {(isUploading || isComplete) && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{
              width: `${percentage}%`,
            }}
          />
        </div>
      )}

      {hasError && (
        <p className="text-xs text-destructive truncate">
          {String(uppyFile.error)}
        </p>
      )}
    </div>
  );
}

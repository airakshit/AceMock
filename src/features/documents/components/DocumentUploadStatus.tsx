"use client";

import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import type Uppy from "@uppy/core";
import { useUppyState } from "@uppy/react";
import type { DocumentUploadMeta } from "../uploads/upload.types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DocumentUploadStatusProps {
  uppy: Uppy<DocumentUploadMeta>;
}

export function DocumentUploadStatus({ uppy }: DocumentUploadStatusProps) {
  const files = useUppyState(uppy, (state) => Object.values(state.files));

  const totalProgress = useUppyState(uppy, (state) => state.totalProgress);

  const currentUploads = useUppyState(uppy, (state) => state.currentUploads);

  if (files.length === 0) {
    return null;
  }

  const hasUploading = files.some(
    (file) => file.progress?.uploadStarted && !file.progress?.uploadComplete,
  );

  const hasFailures = files.some((file) => Boolean(file.error));

  const completedCount = files.filter(
    (file) => file.progress?.uploadComplete,
  ).length;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            {hasUploading
              ? "Uploading files"
              : hasFailures
                ? "Some uploads failed"
                : "Upload complete"}
          </p>

          <p className="text-xs text-muted-foreground">
            {completedCount} of {files.length} files complete
          </p>
        </div>

        <div className="text-sm font-medium">{totalProgress}%</div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{
            width: `${totalProgress}%`,
          }}
        />
      </div>

      <div className="space-y-2">
        {files.map((file) => {
          const progress = file.progress;

          const percentage = progress?.percentage ?? 0;

          const complete = Boolean(progress?.uploadComplete);

          const error = Boolean(file.error);

          return (
            <div key={file.id} className="flex items-center gap-3">
              {complete ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" />
              ) : error ? (
                <CircleAlert className="size-4 shrink-0 text-danger" />
              ) : (
                <Loader2 className="size-4 shrink-0 animate-spin" />
              )}

              <div className="min-w-0 flex-1">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <p
                        className="truncate text-xs cursor-default"
                        title={file.name}
                      />
                    }
                  >
                    {file.name}
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    align="start"
                    className="max-w-xs sm:max-w-sm break-all text-xs font-medium"
                  >
                    {file.name}
                  </TooltipContent>
                </Tooltip>

                {!complete && !error && (
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${percentage}%`,
                      }}
                    />
                  </div>
                )}
              </div>

              <span className="text-xs text-muted-foreground">
                {complete ? "Done" : error ? "Failed" : `${percentage}%`}
              </span>
            </div>
          );
        })}
      </div>

      {hasUploading && (
        <p className="text-xs text-muted-foreground">
          {Object.keys(currentUploads).length} uploads active
        </p>
      )}
    </div>
  );
}

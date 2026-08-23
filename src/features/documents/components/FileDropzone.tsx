"use client";

import {
  CheckCircle2,
  CircleAlert,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";

import { useRef, useState, type ComponentType, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { DocumentFileItem } from "../schemas";
import type { FileProgressState } from "../uploads/upload.types";
import { formatBytes } from "../utils";
import { MobileFilePicker } from "./MobileFilePicker";

interface FileDropzoneProps {
  id: string;
  label: string;
  title: string;
  description: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  icon: ComponentType<{
    className?: string;
  }>;

  /**
   * React Hook Form owns this value array of DocumentFileItems ({ clientFileId, file }).
   */
  value: DocumentFileItem[];

  /**
   * React Hook Form setter.
   */
  onChange: (items: DocumentFileItem[]) => void;

  /**
   * Called after new files are selected or dropped.
   * Synchronizes files into Uppy using clientFileId.
   */
  onFilesAdded?: (addedItems: DocumentFileItem[]) => void;

  /**
   * Called when a file is removed by clientFileId.
   */
  onFileRemoved?: (clientFileId: string) => void;

  /**
   * Live upload progress map keyed by clientFileId.
   */
  uploadStates?: Record<string, FileProgressState>;

  /**
   * File upload control handlers.
   */
  onPauseFile?: (clientFileId: string) => void;
  onResumeFile?: (clientFileId: string) => void;
  onRetryFile?: (clientFileId: string) => void;

  invalid?: boolean;
  numbered?: boolean;
}

export function FileDropzone({
  id,
  label,
  title,
  description,
  accept,
  multiple = true,
  disabled = false,
  icon: Icon,
  value,
  onChange,
  onFilesAdded,
  onFileRemoved,
  uploadStates,
  onPauseFile,
  onResumeFile,
  onRetryFile,
  invalid,
  numbered,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const openPicker = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const processRawFiles = (rawFiles: FileList | File[]) => {
    const fileList = Array.from(rawFiles);
    if (fileList.length === 0) return;

    const newItems: DocumentFileItem[] = fileList.map((file) => ({
      clientFileId: crypto.randomUUID(),
      file,
    }));

    const updatedValue = multiple ? [...value, ...newItems] : newItems;
    onChange(updatedValue);
    onFilesAdded?.(newItems);
  };

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (event.target.files) {
      processRawFiles(event.target.files);
      event.target.value = "";
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled && !isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      processRawFiles(event.dataTransfer.files);
    }
  };

  const removeFile = (clientFileId: string) => {
    onChange(value.filter((item) => item.clientFileId !== clientFileId));
    onFileRemoved?.(clientFileId);
  };

  const hiddenInput = (
    <Input
      id={id}
      ref={inputRef}
      type="file"
      accept={accept}
      multiple={multiple}
      disabled={disabled}
      className="hidden"
      onClick={(event) => event.stopPropagation()}
      onChange={handleFileInputChange}
    />
  );

  if (value.length === 0) {
    return (
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={openPicker}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && !disabled) {
            event.preventDefault();
            openPicker();
          }
        }}
        className={cn(
          "relative flex w-full min-w-0 flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200 cursor-pointer select-none",
          isDragging
            ? "border-primary bg-primary/5 shadow-inner scale-[0.99]"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40",
          invalid && "border-destructive/80 bg-destructive/5",
          disabled &&
            "cursor-not-allowed opacity-60 hover:bg-transparent hover:border-muted-foreground/25",
        )}
      >
        <div className="flex flex-col items-center justify-center gap-3 py-4">
          <div className="flex size-12 items-center justify-center rounded-full border bg-background/80 shadow-xs transition-transform group-hover:scale-105">
            <Icon className="size-6 text-muted-foreground" />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold tracking-tight">{title}</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {description}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="mt-1 shadow-2xs sm:flex"
            onClick={(event) => {
              event.stopPropagation();
              openPicker();
            }}
          >
            <Upload className="mr-2 size-3.5" />
            Browse {label.toLowerCase()}
          </Button>

          {/* Touch-optimized mobile camera/photos/documents picker (only visible on mobile screens) */}
          <div
            className="w-full pt-2 block sm:hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <MobileFilePicker
              accept={accept}
              multiple={multiple}
              disabled={disabled}
              onFilesSelected={(files) => processRawFiles(files)}
            />
          </div>
        </div>

        {hiddenInput}
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "w-full min-w-0 space-y-3 rounded-xl border p-3.5 bg-card transition-all",
        isDragging && "border-primary bg-primary/5 shadow-inner",
        invalid && "border-destructive/80 bg-destructive/5",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <Badge variant="secondary" className="text-xs font-mono">
            {value.length} {value.length === 1 ? "file" : "files"}
          </Badge>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={openPicker}
          aria-label={`Add more ${label.toLowerCase()}`}
          className="h-8 shrink-0 gap-1.5 px-2.5 text-xs shadow-2xs"
        >
          <Upload className="size-3.5" />
          <span>Add more</span>
        </Button>

        {hiddenInput}
      </div>

      <div className="space-y-2 max-h-85 overflow-y-auto pr-1">
        {value.map((item, index) => {
          const uploadState = uploadStates?.[item.clientFileId];
          const status = uploadState?.status || "idle";
          const percentage = uploadState?.percentage ?? 0;
          const isUploading = status === "uploading";
          const isPaused = status === "paused";
          const isComplete = status === "success";
          const hasError = status === "error";

          return (
            <div
              key={item.clientFileId}
              className={cn(
                "group relative flex flex-col gap-2 rounded-lg border bg-background p-3 transition-all",
                isUploading && "border-primary/40 bg-primary/5",
                isComplete && "border-emerald-500/30 bg-emerald-500/5",
                hasError && "border-destructive/50 bg-destructive/5",
              )}
            >
              <div className="flex items-center gap-3">
                {numbered && (
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground font-mono">
                    {index + 1}
                  </span>
                )}

                <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                  <Icon className="size-4 text-muted-foreground" />
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-foreground">
                      {item.file.name}
                    </p>

                    {/* Status Badge */}
                    {status === "preparing" && (
                      <Badge
                        variant="outline"
                        className="gap-1 text-[10px] py-0 px-1.5 h-5 text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-400"
                      >
                        <Loader2 className="size-3 animate-spin" />
                        Preparing
                      </Badge>
                    )}

                    {isUploading && (
                      <Badge
                        variant="default"
                        className="gap-1 text-[10px] py-0 px-1.5 h-5 bg-primary font-mono"
                      >
                        <Loader2 className="size-2.5 animate-spin" />
                        {percentage}%
                      </Badge>
                    )}

                    {isPaused && (
                      <Badge
                        variant="secondary"
                        className="gap-1 text-[10px] py-0 px-1.5 h-5 text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400"
                      >
                        <Pause className="size-2.5" />
                        Paused
                      </Badge>
                    )}

                    {isComplete && (
                      <Badge
                        variant="outline"
                        className="gap-1 text-[10px] py-0 px-1.5 h-5 text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400"
                      >
                        <CheckCircle2 className="size-3" />
                        Done
                      </Badge>
                    )}

                    {hasError && (
                      <Badge
                        variant="destructive"
                        className="gap-1 text-[10px] py-0 px-1.5 h-5"
                      >
                        <CircleAlert className="size-3" />
                        Error
                      </Badge>
                    )}

                    {status === "idle" && (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {formatBytes(item.file.size)}
                      </span>
                    )}
                  </div>

                  {/* Detailed status subtitle */}
                  {uploadState && (isUploading || isPaused) && (
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {formatBytes(uploadState.bytesUploaded)} /{" "}
                      {formatBytes(uploadState.bytesTotal)}
                    </p>
                  )}

                  {hasError && (
                    <p className="text-[11px] text-destructive truncate">
                      {uploadState?.error || "Upload failed"}
                    </p>
                  )}
                </div>

                {/* Control Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {isUploading && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      title="Pause upload"
                      onClick={() => onPauseFile?.(item.clientFileId)}
                    >
                      <Pause className="size-3.5 text-muted-foreground" />
                    </Button>
                  )}

                  {isPaused && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      title="Resume upload"
                      onClick={() => onResumeFile?.(item.clientFileId)}
                    >
                      <Play className="size-3.5 text-primary" />
                    </Button>
                  )}

                  {hasError && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      title="Retry upload"
                      onClick={() => onRetryFile?.(item.clientFileId)}
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>
                  )}

                  {!disabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive transition-colors"
                      title="Remove file"
                      onClick={() => removeFile(item.clientFileId)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress bar line */}
              {(isUploading || isPaused || isComplete) && (
                <div className="w-full pt-1">
                  <Progress value={percentage} className="h-1.5 w-full" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

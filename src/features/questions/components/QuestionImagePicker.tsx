"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/features/documents/utils";
import type { QuestionFileItem } from "./types";
import type { FileProgressState } from "../uploads/upload.types";

interface QuestionImagePickerProps {
  id: string;
  label: string;
  title: string;
  description?: string;
  value: QuestionFileItem | null | undefined;
  onChange: (value: QuestionFileItem | null) => void;
  onFileAdded?: (item: QuestionFileItem) => void;
  onFileRemoved?: (clientFileId: string) => void;
  uploadState?: FileProgressState;
  disabled?: boolean;
}

export function QuestionImagePicker({
  id,
  label,
  title,
  description,
  value,
  onChange,
  onFileAdded,
  onFileRemoved,
  uploadState,
  disabled = false,
}: QuestionImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (value?.file) {
      const url = URL.createObjectURL(value.file);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [value?.file]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      return;
    }
    const item: QuestionFileItem = {
      clientFileId: crypto.randomUUID(),
      file,
    };
    onChange(item);
    onFileAdded?.(item);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      handleFile(event.target.files[0]);
      event.target.value = "";
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      handleFile(event.dataTransfer.files[0]);
    }
  };

  const handleRemove = () => {
    if (value) {
      onFileRemoved?.(value.clientFileId);
      onChange(null);
    }
  };

  const status = uploadState?.status || "idle";
  const isUploading = status === "uploading";
  const isComplete = status === "success";
  const hasError = status === "error";
  const percentage = uploadState?.percentage ?? 0;

  if (value && previewUrl) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            {label}
          </span>
          {!disabled && !isUploading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="h-6 px-1.5 text-xs text-muted-foreground hover:text-destructive gap-1"
            >
              <X className="size-3" />
              <span>Remove</span>
            </Button>
          )}
        </div>

        <div
          className={cn(
            "relative flex items-center gap-3 rounded-xl border bg-card p-3 transition-all",
            isUploading && "border-primary/40 bg-primary/5",
            isComplete && "border-emerald-500/30 bg-emerald-500/5",
            hasError && "border-destructive/50 bg-destructive/5",
          )}
        >
          {/* Image Thumbnail */}
          <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Preview"
              className="size-full object-cover"
            />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-medium text-foreground">
                {value.file.name}
              </p>

              {isUploading && (
                <Badge
                  variant="default"
                  className="gap-1 text-[10px] py-0 px-1.5 h-5 bg-primary font-mono shrink-0"
                >
                  <Loader2 className="size-2.5 animate-spin" />
                  {percentage}%
                </Badge>
              )}

              {isComplete && (
                <Badge
                  variant="outline"
                  className="gap-1 text-[10px] py-0 px-1.5 h-5 text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400 shrink-0"
                >
                  <CheckCircle2 className="size-3" />
                  Uploaded
                </Badge>
              )}

              {hasError && (
                <Badge
                  variant="destructive"
                  className="gap-1 text-[10px] py-0 px-1.5 h-5 shrink-0"
                >
                  <CircleAlert className="size-3" />
                  Failed
                </Badge>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground font-mono">
              {formatBytes(value.file.size)}
            </p>

            {isUploading && (
              <div className="w-full pt-0.5">
                <Progress value={percentage} className="h-1.5 w-full" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">
        {label}
      </span>

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={cn(
          "relative flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all duration-200 cursor-pointer select-none",
          isDragging
            ? "border-primary bg-primary/5 shadow-inner scale-[0.99]"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40",
          disabled && "cursor-not-allowed opacity-60 hover:bg-transparent",
        )}
      >
        <div className="flex flex-col items-center justify-center gap-1.5 py-1">
          <div className="flex size-8 items-center justify-center rounded-full border bg-background shadow-2xs">
            <ImageIcon className="size-4 text-muted-foreground" />
          </div>

          <div className="space-y-0.5">
            <p className="text-xs font-semibold tracking-tight">{title}</p>
            {description && (
              <p className="text-[11px] text-muted-foreground">
                {description}
              </p>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="mt-1 h-7 text-xs px-2.5 shadow-2xs"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            <Upload className="mr-1.5 size-3" />
            Upload image
          </Button>
        </div>

        <input
          id={id}
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={disabled}
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    </div>
  );
}

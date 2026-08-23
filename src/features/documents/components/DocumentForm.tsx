"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  FileText,
  Image as ImageIcon,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { layout } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { MiniHorizontalList } from "@/components/shared/MiniHorizontalList";
import { contentTypeItems } from "../constants";

import {
  documentFormSchema,
  type DocumentFormData,
  type DocumentFileItem,
} from "../schemas";
import { FileDropzone } from "./FileDropzone";
import {
  CreateNewDocumentActionPayload,
  CreateNewDocumentActionResponse,
  FinalizeDocumentUploadActionPayload,
  FinalizeDocumentUploadActionResponse,
} from "../actions/types";
import { finalizeDocumentUploadAction } from "../actions/finalize-document-upload";
import { ServerActionResult } from "@/features/shared/actions/types";
import { useDocumentUploader } from "../uploads/use-document-uploader";

interface DocumentFormProps {
  onSumbitAction: (
    data: CreateNewDocumentActionPayload,
  ) => Promise<ServerActionResult<CreateNewDocumentActionResponse>>;
  onFinalizeAction?: (
    data: FinalizeDocumentUploadActionPayload,
  ) => Promise<ServerActionResult<FinalizeDocumentUploadActionResponse>>;
}

export function DocumentForm({
  onSumbitAction,
  onFinalizeAction = finalizeDocumentUploadAction,
}: DocumentFormProps) {
  const router = useRouter();
  const [showDescription, setShowDescription] = useState(false);
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [isUploadingStarted, setIsUploadingStarted] = useState(false);

  const {
    uploadStates,
    totalProgress,
    addFiles,
    removeFile,
    pauseFile,
    resumeFile,
    retryFile,
    pauseAll,
    resumeAll,
    retryAll,
    clear,
    setCredentials,
    upload,
  } = useDocumentUploader();

  const form = useForm<DocumentFormData>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      title: "",
      description: "",
      contentType: undefined,
      pdfs: [],
      images: [],
    },
  });

  const pdfsValue = form.watch("pdfs");
  const imagesValue = form.watch("images");
  const totalFilesCount = pdfsValue.length + imagesValue.length;

  const onSubmit = async (data: DocumentFormData) => {
    const allItems = [...data.pdfs, ...data.images];
    if (allItems.length === 0) {
      toast.error("Please add at least one PDF or image file.");
      return;
    }

    const pdfPayloads = data.pdfs.map((item) => ({
      clientFileId: item.clientFileId,
      name: item.file.name,
      size: item.file.size,
      type: item.file.type || "application/pdf",
    }));

    const imagePayloads = data.images.map((item) => ({
      clientFileId: item.clientFileId,
      name: item.file.name,
      size: item.file.size,
      type: item.file.type || "image/jpeg",
    }));

    const payload: CreateNewDocumentActionPayload = {
      title: data.title,
      contentType: data.contentType,
      description: data.description,
      pdfs: pdfPayloads,
      images: imagePayloads,
    };

    setIsCreatingDoc(true);
    try {
      const result = await onSumbitAction(payload);

      if (result.success) {
        setCredentials(result.data.files);
        setIsUploadingStarted(true);
        const uploadResult = await upload();

        const successfulServerFileIds = (uploadResult?.successful || [])
          .map((f) => f.meta?.serverFileId as string)
          .filter(Boolean);

        const fileIdsToFinalize =
          successfulServerFileIds.length > 0
            ? successfulServerFileIds
            : result.data.files.map((f) => f.serverFileId);

        if (fileIdsToFinalize.length > 0) {
          const finalizeResult = await onFinalizeAction({
            documentId: result.data.documentId,
            fileIds: fileIdsToFinalize,
          });

          if (finalizeResult.success) {
            toast.success("Upload completed successfully!");
            router.refresh();
          } else {
            toast.error(finalizeResult.error.message);
          }
        }
      } else {
        toast.error(result.error.message);
      }
    } catch (error) {
      toast.error("Failed to create document upload.");
      console.error(error);
    } finally {
      setIsCreatingDoc(false);
    }
  };

  const handleRemoveDescription = () => {
    form.setValue("description", "");
    setShowDescription(false);
  };

  const handleReset = () => {
    clear();
    form.reset({
      title: "",
      description: "",
      contentType: undefined,
      pdfs: [],
      images: [],
    });
    setShowDescription(false);
    setIsUploadingStarted(false);
  };

  const handleFilesAdded = (addedItems: DocumentFileItem[]) => {
    addFiles(addedItems);
  };

  const handleFileRemoved = (clientFileId: string) => {
    removeFile(clientFileId);
  };

  const [isOpen, setIsOpen] = useState(true);

  const isAllComplete = isUploadingStarted && totalProgress === 100;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="w-full rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden"
    >
      {/* Top row container */}
      <div
        className={cn(
          "w-full flex items-center justify-between gap-3 p-4 sm:p-6 transition-colors hover:bg-muted/40",
          isOpen && "border-b",
        )}
      >
        <CollapsibleTrigger className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer select-none focus:outline-none">
          <span className="text-base sm:text-lg font-bold truncate">
            Create Document
          </span>

          {!isOpen && totalFilesCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {totalFilesCount} {totalFilesCount === 1 ? "file" : "files"}
            </span>
          )}
        </CollapsibleTrigger>

        <div className="flex items-center gap-2 shrink-0">
          {isUploadingStarted && isOpen && (
            <div className="flex items-center gap-1.5">
              {!isAllComplete && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 px-2"
                    onClick={pauseAll}
                  >
                    <Pause className="size-3" />
                    <span className="hidden sm:inline">Pause All</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 px-2"
                    onClick={resumeAll}
                  >
                    <Play className="size-3" />
                    <span className="hidden sm:inline">Resume All</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 px-2"
                    onClick={retryAll}
                  >
                    <RotateCcw className="size-3" />
                    <span className="hidden sm:inline">Retry All</span>
                  </Button>
                </>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] gap-1 px-2 text-destructive hover:text-destructive"
                onClick={handleReset}
              >
                <Trash2 className="size-3" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            </div>
          )}

          <CollapsibleTrigger className="flex size-8 items-center justify-center text-muted-foreground focus:outline-none cursor-pointer">
            {isOpen ? (
              <ChevronUp className="size-5" />
            ) : (
              <ChevronDown className="size-5" />
            )}
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent>
        <div className="p-4 sm:p-6 pt-6">
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className={cn(layout.fieldStack, "space-y-6")}
          >
            <FieldGroup className={layout.fieldStack}>
              {/* Content Type */}
              <Controller
                name="contentType"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="min-w-0">
                    <FieldLabel>Content Type</FieldLabel>

                    <MiniHorizontalList
                      items={contentTypeItems}
                      value={field.value}
                      onChange={field.onChange}
                    />

                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              {/* Title */}
              <Controller
                name="title"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="min-w-0">
                    <FieldLabel htmlFor="title">Title</FieldLabel>

                    <Input
                      {...field}
                      id="title"
                      placeholder="e.g. Physics Mechanics Chapter 1"
                      aria-invalid={fieldState.invalid}
                      disabled={isCreatingDoc || isUploadingStarted}
                    />

                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              {/* Description */}
              {showDescription ? (
                <Controller
                  name="description"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="min-w-0"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <FieldLabel htmlFor="description">
                          Description
                        </FieldLabel>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveDescription}
                          disabled={isCreatingDoc || isUploadingStarted}
                          className="h-7 shrink-0 px-2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-3.5" />
                          <span className="hidden sm:inline text-xs">
                            Remove
                          </span>
                        </Button>
                      </div>

                      <Textarea
                        {...field}
                        id="description"
                        placeholder="Describe what this document contains..."
                        rows={3}
                        aria-invalid={fieldState.invalid}
                        disabled={isCreatingDoc || isUploadingStarted}
                      />

                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDescription(true)}
                  disabled={isCreatingDoc || isUploadingStarted}
                  className="w-full border-dashed sm:w-fit text-xs h-8"
                >
                  <Plus className="size-3.5" />
                  Add description
                </Button>
              )}

              {/* File Dropzones with live upload progress */}
              <div className="grid gap-6 md:grid-cols-2 pt-2">
                {/* PDFs */}
                <Controller
                  name="pdfs"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="min-w-0"
                    >
                      <FieldLabel htmlFor="pdfs">PDF Files</FieldLabel>

                      <FileDropzone
                        id="pdfs"
                        label="PDF files"
                        title="Upload PDF files"
                        description="Select one or more PDF files (max 50 MB each)"
                        accept="application/pdf"
                        icon={FileText}
                        value={field.value}
                        onChange={field.onChange}
                        onFilesAdded={handleFilesAdded}
                        onFileRemoved={handleFileRemoved}
                        uploadStates={uploadStates}
                        onPauseFile={pauseFile}
                        onResumeFile={resumeFile}
                        onRetryFile={retryFile}
                        disabled={isCreatingDoc || isUploadingStarted}
                        invalid={fieldState.invalid}
                      />

                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                {/* Images */}
                <Controller
                  name="images"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="min-w-0"
                    >
                      <FieldLabel htmlFor="images">Images</FieldLabel>

                      <FileDropzone
                        id="images"
                        label="Images"
                        title="Upload images"
                        description="Images will be uploaded in selected order"
                        accept="image/*"
                        icon={ImageIcon}
                        value={field.value}
                        onChange={field.onChange}
                        onFilesAdded={handleFilesAdded}
                        onFileRemoved={handleFileRemoved}
                        uploadStates={uploadStates}
                        onPauseFile={pauseFile}
                        onResumeFile={resumeFile}
                        onRetryFile={retryFile}
                        disabled={isCreatingDoc || isUploadingStarted}
                        invalid={fieldState.invalid}
                        numbered
                      />

                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
            </FieldGroup>

            {!isUploadingStarted ? (
              <Button
                type="submit"
                className="h-11 w-full text-sm font-semibold shadow-sm"
                disabled={isCreatingDoc || totalFilesCount === 0}
              >
                {isCreatingDoc ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            ) : !isAllComplete ? (
              <Button
                type="button"
                className="h-11 w-full text-sm font-semibold shadow-sm"
                disabled
              >
                <Loader2 className="mr-2 size-4 animate-spin" />
                Uploading...
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full font-medium"
                onClick={handleReset}
              >
                <CheckCircle2 className="mr-2 size-4 text-emerald-500" />
                Start New Document Upload
              </Button>
            )}
          </form>
        </div>

        <div className="border-t px-4 sm:px-6 py-3 text-xs text-muted-foreground">
          Max 50MB per file
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

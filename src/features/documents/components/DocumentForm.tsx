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
  Upload,
  X,
} from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
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
import { documentFormSchema, type DocumentFormData } from "../schemas";
import { FileDropzone } from "./FileDropzone";
import {
  CreateDocumentActionPayload,
  CreateDocumentActionResponse,
} from "../actions/types";
import { ServerActionResult } from "@/features/shared/actions/types";
import { useDocumentUploaderContext } from "../uploads/document-uploader-provider";
import type { ResumableFileView } from "../uploads/document-uploader-provider";
import { computeContentProbe } from "../uploads/upload-probe";
import { formatBytes } from "../utils";

interface DocumentFormProps {
  onSumbitAction: (
    data: CreateDocumentActionPayload,
  ) => Promise<ServerActionResult<CreateDocumentActionResponse>>;
}

export function DocumentForm({ onSumbitAction }: DocumentFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [isUploadingStarted, setIsUploadingStarted] = useState(false);

  const {
    uploadStates,
    totalProgress,
    removeFile,
    pauseFile,
    resumeFile,
    retryFile,
    pauseAll,
    resumeAll,
    retryAll,
    clear,
    resumeTarget,
    clearResumeTarget,
    attachReselectedFile,
    beginUploadSession,
    endActiveSessionTracking,
    isResumeBusy,
  } = useDocumentUploaderContext();

  const activeDocumentIdRef = useRef<string | null>(null);

  const form = useForm<DocumentFormData>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      title: "",
      description: "",
      pdfs: [],
      images: [],
    },
  });

  const pdfsValue = form.watch("pdfs");
  const imagesValue = form.watch("images");
  const totalFilesCount = pdfsValue.length + imagesValue.length;

  /**
   * ---- Hydration when a resume session is started ----
   *
   * Resume does NOT go through the create flow: the server action re-signed
   * the same storagePaths (upsert: true), the provider already enqueued the
   * restored files into Uppy and started the batch. This effect hydrates the
   * form view around it â€” title/description back into inputs, and the
   * restored files mapped into the form arrays so the dropzones render live
   * progress rows (uploadStates is keyed by clientFileId either way).
   */
  useEffect(() => {
    if (!resumeTarget) return;

    activeDocumentIdRef.current = resumeTarget.documentId;
    setIsOpen(true);
    setIsUploadingStarted(true);
    setShowDescription(Boolean(resumeTarget.description));

    const pdfItems = resumeTarget.files
      .filter((view) => view.mimeType === "application/pdf")
      .map((view) => ({ clientFileId: view.clientFileId, file: view.file! }));

    const imageItems = resumeTarget.files
      .filter((view) => view.mimeType !== "application/pdf")
      .map((view) => ({ clientFileId: view.clientFileId, file: view.file! }));

    form.reset({
      title: resumeTarget.title,
      description: resumeTarget.description ?? "",
      pdfs: pdfItems,
      images: imageItems,
    });
  }, [resumeTarget, form]);

  const onSubmit = async (data: DocumentFormData) => {
    const allItems = [...data.pdfs, ...data.images];
    if (allItems.length === 0) {
      toast.error("Please add at least one PDF or image file.");
      return;
    }

    /**
     * Content probes are computed from the selected files BEFORE the create
     * action â€” the server stores them, and later re-selects are verified
     * against the exact same fingerprint. This is the identity the session
     * remembers; filenames/sizes are never trusted for identity.
     */
    const probes = new Map<string, string>();
    const fileHandles = new Map<string, FileSystemFileHandle | null>();

    setIsCreatingDoc(true);
    try {
      for (const item of allItems) {
        probes.set(item.clientFileId, await computeContentProbe(item.file));
        fileHandles.set(item.clientFileId, item.fileHandle ?? null);
      }

      const pdfPayloads = data.pdfs.map((item) => ({
        clientFileId: item.clientFileId,
        name: item.file.name,
        size: item.file.size,
        type: item.file.type || "application/pdf",
        contentProbe: probes.get(item.clientFileId) ?? "",
      }));

      const imagePayloads = data.images.map((item) => ({
        clientFileId: item.clientFileId,
        name: item.file.name,
        size: item.file.size,
        type: item.file.type || "image/jpeg",
        contentProbe: probes.get(item.clientFileId) ?? "",
      }));

      const payload: CreateDocumentActionPayload = {
        title: data.title,
        description: data.description,
        pdfs: pdfPayloads,
        images: imagePayloads,
      };

      const result = await onSumbitAction(payload);

      if (!result.success) {
        toast.error(result.error.message);
        return;
      }

      const documentId = result.data.documentId;

      /**
       * From here on the SERVER owns the attempt (upload session id, tokens,
       * TUS references). The provider persists identity metadata â€” never
       * bytes â€” acquires the cross-tab Web Lock and starts the coordinator
       * (heartbeats, ref-sync, per-file completion, session commit).
       */
      const started = await beginUploadSession({
        documentId,
        sessionId: result.data.sessionId,
        title: data.title,
        description: data.description ?? null,
        files: allItems,
        probes,
        fileHandles,
        credentials: result.data.files,
        onLocked: () => {},
      });

      if (!started) {
        // Lock was unavailable (another tab owns this session) â€” nothing
        // was started; the attempt can be resumed later from the card.
        return;
      }

      setIsUploadingStarted(true);
      activeDocumentIdRef.current = documentId;
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
    const activeDocumentId = activeDocumentIdRef.current;

    if (activeDocumentId) {
      /**
       * Stop tracking WITHOUT touching server state: the upload session
       * stays exactly as it is (files keep their progress), and the
       * attempt remains resumable from the document card. Closing the
       * coordinator releases the Web Lock â€” it never cancels uploads.
       */
      endActiveSessionTracking();
      activeDocumentIdRef.current = null;
    }

    clear();
    form.reset({
      title: "",
      description: "",
      pdfs: [],
      images: [],
    });
    setShowDescription(false);
    setIsUploadingStarted(false);
    clearResumeTarget();
  };

  const handleFileRemoved = (clientFileId: string) => {
    removeFile(clientFileId);
  };

  const isAllComplete = isUploadingStarted && totalProgress === 100;

  /**
   * When the visible progress bar hits 100% (every file's bytes are in
   * storage), refresh the server-rendered list so the user sees the
   * "uploaded" statuses â€” the actual DB flip happened in the runtime's
   * finalize. Runs once per local completion cycle.
   */
  const didRefreshRef = useRef(false);
  useEffect(() => {
    if (!isAllComplete) {
      didRefreshRef.current = false;
      return;
    }
    if (didRefreshRef.current) return;
    didRefreshRef.current = true;
    router.refresh();
  }, [isAllComplete, router]);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="w-full overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-card"
    >
      {/* Top row container */}
      <div
        className={cn(
          "flex w-full items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40 sm:p-5",
          isOpen && "border-b",
        )}
      >
        <CollapsibleTrigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left select-none focus:outline-none">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand">
            <FileText className="size-4.5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-heading text-base font-bold tracking-tight sm:text-lg">
              {resumeTarget ? "Resume Document Upload" : "Create Document"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {resumeTarget
                ? "Continuing an interrupted upload â€” files restored locally"
                : "Upload PDFs or images to build a practice set"}
            </span>
          </span>

          {!isOpen && totalFilesCount > 0 && (
            <span className="ml-1 inline-flex shrink-0 items-center rounded-full bg-brand-muted px-2.5 py-0.5 text-xs font-medium text-brand">
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

              {/* Files that need a manual re-select (blob evicted/missing) */}
              {resumeTarget && resumeTarget.filesNeedingReselect.length > 0 && (
                <div className="space-y-2 rounded-xl border border-warning/40 bg-warning/5 p-3.5">
                  <p className="flex items-center gap-2 text-xs font-semibold text-warning">
                    <CircleAlert className="size-3.5" />
                    {resumeTarget.filesNeedingReselect.length} file(s) could not
                    be restored locally â€” re-select to continue
                  </p>
                  <ReselectRows
                    items={resumeTarget.filesNeedingReselect}
                    onReselect={(view, file) =>
                      attachReselectedFile(view, file)
                    }
                  />
                </div>
              )}
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
                {isResumeBusy ? "Restoring session..." : "Uploading..."}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full font-medium"
                onClick={handleReset}
              >
                <CheckCircle2 className="mr-2 size-4 text-success" />
                {resumeTarget ? "Done" : "Start  Document Upload"}
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

// ---------------------------------------------------------------------------
// Reselect rows (files whose persisted blob was evicted / never stored)
// ---------------------------------------------------------------------------

function ReselectRows({
  items,
  onReselect,
}: {
  items: ResumableFileView[];
  onReselect: (view: ResumableFileView, file: File) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((view) => (
        <ReselectRow
          key={view.serverFileId}
          view={view}
          onReselect={onReselect}
        />
      ))}
    </div>
  );
}

function ReselectRow({
  view,
  onReselect,
}: {
  view: ResumableFileView;
  onReselect: (view: ResumableFileView, file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium" title={view.filename}>
          {view.filename}
        </p>
        <p className="text-[10px] font-mono text-muted-foreground">
          {formatBytes(view.fileSize)}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 shrink-0 gap-1.5 px-2.5 text-xs"
        onClick={() => inputRef.current?.click()}
        disabled={isBusy}
      >
        {isBusy ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Upload className="size-3" />
        )}
        Re-select file
      </Button>

      <input
        ref={inputRef}
        type="file"
        accept={view.mimeType || undefined}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setIsBusy(true);
          try {
            onReselect(view, file);
          } finally {
            setIsBusy(false);
          }
        }}
      />
    </div>
  );
}

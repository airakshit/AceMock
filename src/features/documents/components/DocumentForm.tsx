"use client";

import { Files, Loader2, Plus, X } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { computeContentProbe } from "../uploads/upload-probe";

/** Window event that makes the documents list refetch (see YourDocuments). */
const DOCUMENTS_REFRESH_EVENT = "documents:refresh";
/**
 * Window event carrying the freshly created document's FULL DTO (the
 * exact data get-user-documents returns) so the list can insert the new
 * card instantly — no refetch wait — and play its entrance animation.
 */
const DOCUMENTS_CREATED_EVENT = "documents:created";

interface DocumentFormProps {
  /**
   * Popup visibility — owned by the page-level nav (DocumentsNav): its
   * Create button opens this dialog.
   */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSumbitAction: (
    data: CreateDocumentActionPayload,
  ) => Promise<ServerActionResult<CreateDocumentActionResponse>>;
}

/**
 * DocumentForm — a PURE create form.
 *
 * It knows nothing about uploads: no progress, no pause/resume, no session
 * state. The moment the server accepts the create action it hands the
 * attempt to the provider (beginUploadSession) and closes — from then on
 * the upload lives entirely in the document card in the list below, which
 * shows the document as "uploading" with per-file live progress.
 */
export function DocumentForm({
  open,
  onOpenChange,
  onSumbitAction,
}: DocumentFormProps) {
  const [showDescription, setShowDescription] = useState(false);
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);

  const { beginUploadSession, removeFile } = useDocumentUploaderContext();

  const form = useForm<DocumentFormData>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      title: "",
      description: "",
      files: [],
    },
  });

  const filesValue = form.watch("files");
  const totalFilesCount = filesValue.length;

  useEffect(() => {
    // Fresh form every time the popup opens.
    if (open) {
      form.reset({
        title: "",
        description: "",
        files: [],
      });
      setShowDescription(false);
    }
  }, [open, form]);

  const onSubmit = async (data: DocumentFormData) => {
    if (data.files.length === 0) {
      toast.error("Please add at least one PDF or image file.");
      return;
    }

    /**
     * Content probes are computed from the selected files BEFORE the create
     * action — the server stores them, and later re-selects are verified
     * against the exact same fingerprint. This is the identity the session
     * remembers; filenames/sizes are never trusted for identity.
     */
    const probes = new Map<string, string>();
    const fileHandles = new Map<string, FileSystemFileHandle | null>();

    setIsCreatingDoc(true);
    try {
      for (const item of data.files) {
        probes.set(item.clientFileId, await computeContentProbe(item.file));
        fileHandles.set(item.clientFileId, item.fileHandle ?? null);
      }

      // One mixed list in the UI; the server payload still keeps the two
      // payload groups separate.
      const pdfPayloads = data.files
        .filter((item) => item.file.type === "application/pdf")
        .map((item) => ({
          clientFileId: item.clientFileId,
          name: item.file.name,
          size: item.file.size,
          type: item.file.type || "application/pdf",
          contentProbe: probes.get(item.clientFileId) ?? "",
        }));

      const imagePayloads = data.files
        .filter((item) => item.file.type !== "application/pdf")
        .map((item) => ({
          clientFileId: item.clientFileId,
          name: item.file.name,
          size: item.file.size,
          type: item.file.type || "image/jpeg",
          contentProbe: probes.get(item.clientFileId) ?? "",
        }));

      const result = await onSumbitAction({
        title: data.title,
        description: data.description,
        pdfs: pdfPayloads,
        images: imagePayloads,
      });

      if (!result.success) {
        toast.error(result.error.message);
        return;
      }

      /**
       * The document enters the list INSTANTLY — straight from the create
       * response (same DTO the list renders), before the upload bootstrap
       * even starts. This ordering is what makes "create then immediately
       * close the popup" safe: the event has already fired, and everything
       * below keeps running in this closure regardless of dialog state —
       * the upload itself is owned by the provider, never by the form.
       */
      window.dispatchEvent(
        new CustomEvent(DOCUMENTS_CREATED_EVENT, {
          detail: { document: result.data.document },
        }),
      );

      /**
       * From here on the SERVER owns the attempt (upload session id, tokens,
       * TUS references). The provider persists identity metadata — never
       * bytes — acquires the cross-tab Web Lock and starts the coordinator
       * (heartbeats, ref-sync, per-file completion, session commit). The
       * form's job ends here: the card in the list takes over the display.
       */
      const started = await beginUploadSession({
        documentId: result.data.documentId,
        sessionId: result.data.sessionId,
        title: data.title,
        description: data.description ?? null,
        files: data.files,
        probes,
        fileHandles,
        credentials: result.data.files,
        onLocked: () => {},
      });

      if (!started) {
        // Lock was unavailable (another tab owns this session). The
        // document still exists server-side — the list shows it, and a
        // refetch reconciles the card with the other tab's live truth.
        toast.info(
          "This upload is already running in another tab — progress is shown on its document card.",
        );
        window.dispatchEvent(new Event(DOCUMENTS_REFRESH_EVENT));
      }

      // The form is done and gets out of the way (no-op if the popup was
      // already closed — closing never cancels the running upload).
      form.reset({ title: "", description: "", files: [] });
      setShowDescription(false);
      onOpenChange(false);
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

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Closing never cancels anything — if an upload already started,
        // it continues in the background and lives on the document card.
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-semibold">Create Document</DialogTitle>
          <DialogDescription className="text-xs">
            Upload PDFs or images to build a practice set.
          </DialogDescription>
        </DialogHeader>

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
                    disabled={isCreatingDoc}
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
                        disabled={isCreatingDoc}
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
                      disabled={isCreatingDoc}
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
                disabled={isCreatingDoc}
                className="w-full border-dashed sm:w-fit text-xs h-8"
              >
                <Plus className="size-3.5" />
                Add description
              </Button>
            )}

            {/* Files — one unified dropzone: PDFs and images together */}
            <Controller
              name="files"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="min-w-0">
                  <FieldLabel htmlFor="files">Files</FieldLabel>

                  <FileDropzone
                    id="files"
                    label="Files"
                    title="Upload files"
                    accept="application/pdf,image/*"
                    icon={Files}
                    hints={
                      /*
                       * The allow-list as compact, scannable chips — the eye
                       * should catch "what's allowed" and "how big" without
                       * reading a sentence.
                       */
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand ring-1 ring-inset ring-brand/25">
                          <Files className="size-3" />
                          Only PDFs and Images
                        </span>

                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-inset ring-border">
                          Max 50 MB per file
                        </span>
                      </div>
                    }
                    value={field.value}
                    onChange={field.onChange}
                    onFileRemoved={(clientFileId) =>
                      removeFile(clientFileId)
                    }
                    disabled={isCreatingDoc}
                    invalid={fieldState.invalid}
                  />

                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>

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
        </form>
      </DialogContent>
    </Dialog>
  );
}

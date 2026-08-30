"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Loader2,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { layout } from "@/lib/design-system";
import {
  questionFormSchema,
  type QuestionFormData,
} from "../schemas";
import {
  CreateQuestionActionPayload,
  CreateQuestionActionResponse,
  CreateQuestionFilePayload,
} from "../actions/types";
import { createQuestionAction } from "../actions/create-question";
import { ServerActionResult } from "@/features/shared/actions/types";
import { useQuestionUploader } from "../uploads/use-question-uploader";
import { CurriculumSelector } from "./CurriculumSelector";
import { OptionsEditor } from "./OptionsEditor";
import { QuestionImagePicker } from "./QuestionImagePicker";
import { QuestionDifficulty, QuestionOptionKey } from "../types";

interface QuestionFormProps {
  onSubmitAction?: (
    payload: CreateQuestionActionPayload,
  ) => Promise<ServerActionResult<CreateQuestionActionResponse>>;
  onSuccess?: () => void;
}

const DEFAULT_OPTIONS = [
  { key: "A" as QuestionOptionKey, text: "" },
  { key: "B" as QuestionOptionKey, text: "" },
  { key: "C" as QuestionOptionKey, text: "" },
  { key: "D" as QuestionOptionKey, text: "" },
];

export function QuestionForm({
  onSubmitAction = createQuestionAction,
  onSuccess,
}: QuestionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const {
    uploadStates,
    totalProgress,
    addFile,
    removeFile,
    setCredentials,
    upload,
    clear: clearUploader,
  } = useQuestionUploader();

  const form = useForm<QuestionFormData>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      subjectSlug: "physics",
      sectionSlug: "mechanics",
      chapterSlug: "physical-quantities",
      question: "",
      options: DEFAULT_OPTIONS,
      correctOption: "A",
      marks: 1,
      difficulty: "medium",
      hint: "",
      solution: "",
      diagramFile: null,
      solutionDiagramFile: null,
    },
  });

  const subjectSlug = form.watch("subjectSlug");
  const sectionSlug = form.watch("sectionSlug");
  const chapterSlug = form.watch("chapterSlug");
  const options = form.watch("options");
  const correctOption = form.watch("correctOption");
  const diagramFile = form.watch("diagramFile");
  const solutionDiagramFile = form.watch("solutionDiagramFile");
  const difficulty = form.watch("difficulty");

  const onSubmit = async (data: QuestionFormData) => {
    setIsSubmitting(true);
    try {
      const filesPayload: CreateQuestionFilePayload[] = [];

      if (data.diagramFile?.file) {
        filesPayload.push({
          clientFileId: data.diagramFile.clientFileId,
          name: data.diagramFile.file.name,
          size: data.diagramFile.file.size,
          type: data.diagramFile.file.type || "image/jpeg",
          field: "diagram",
        });
      }

      if (data.solutionDiagramFile?.file) {
        filesPayload.push({
          clientFileId: data.solutionDiagramFile.clientFileId,
          name: data.solutionDiagramFile.file.name,
          size: data.solutionDiagramFile.file.size,
          type: data.solutionDiagramFile.file.type || "image/jpeg",
          field: "solution_diagram",
        });
      }

      const payload: CreateQuestionActionPayload = {
        chapterSlug: data.chapterSlug,
        question: data.question,
        options: data.options,
        correctOption: data.correctOption,
        marks: data.marks,
        difficulty: data.difficulty,
        hint: data.hint || undefined,
        solution: data.solution || undefined,
        files: filesPayload,
      };

      const result = await onSubmitAction(payload);

      if (!result.success) {
        toast.error(result.error.message);
        return;
      }

      // If presigned upload URLs were returned for image files, upload them now
      if (result.data.files.length > 0) {
        setIsUploading(true);
        setCredentials(result.data.files);
        const uploadResult = await upload();

        const hasFailures = (uploadResult?.failed || []).length > 0;
        if (hasFailures) {
          toast.warning("Question created, but some image uploads failed.");
        } else {
          toast.success("Question and images created successfully!");
        }
      } else {
        toast.success("Question created successfully!");
      }

      handleReset();
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create question:", error);
      toast.error("Failed to create question. Please try again.");
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    clearUploader();
    form.reset({
      subjectSlug: "physics",
      sectionSlug: "mechanics",
      chapterSlug: "physical-quantities",
      question: "",
      options: DEFAULT_OPTIONS,
      correctOption: "A",
      marks: 1,
      difficulty: "medium",
      hint: "",
      solution: "",
      diagramFile: null,
      solutionDiagramFile: null,
    });
  };

  const isBusy = isSubmitting || isUploading;

  return (
    <div className="w-full rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="border-b bg-muted/20 px-4 py-4 sm:px-6 flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold">
              <PlusCircle className="size-3.5" />
            </span>
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              Create Question
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Add a multiple-choice question with diagram, 4 options, and detailed solution.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isBusy}
          onClick={handleReset}
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </Button>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 sm:p-6 space-y-6">
        {/* 1. Curriculum (Subject, Section, Chapter) */}
        <section className="rounded-xl border bg-background/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Curriculum & Chapter
            </p>
            <Badge variant="secondary" className="text-[11px] font-mono">
              Slug: {chapterSlug || "none"}
            </Badge>
          </div>

          <CurriculumSelector
            subjectSlug={subjectSlug}
            sectionSlug={sectionSlug}
            chapterSlug={chapterSlug}
            disabled={isBusy}
            onSubjectChange={(val) => form.setValue("subjectSlug", val, { shouldValidate: true })}
            onSectionChange={(val) => form.setValue("sectionSlug", val, { shouldValidate: true })}
            onChapterChange={(val) => form.setValue("chapterSlug", val, { shouldValidate: true })}
            errors={{
              subject: form.formState.errors.subjectSlug?.message,
              section: form.formState.errors.sectionSlug?.message,
              chapter: form.formState.errors.chapterSlug?.message,
            }}
          />
        </section>

        {/* 2. Question Text & Diagram */}
        <section className="space-y-4">
          <Controller
            name="question"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="min-w-0">
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="question" className="text-sm font-semibold">
                    Question Statement *
                  </FieldLabel>
                  <span className="text-xs text-muted-foreground">
                    Markdown / LaTeX supported
                  </span>
                </div>

                <Textarea
                  {...field}
                  id="question"
                  rows={4}
                  disabled={isBusy}
                  placeholder="Enter the question text here..."
                  aria-invalid={fieldState.invalid}
                  className="resize-y text-sm font-sans"
                />

                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {/* Optional Question Diagram */}
          <div className="pt-1">
            <QuestionImagePicker
              id="diagram"
              label="Question Diagram (Optional)"
              title="Add a question diagram or figure"
              description="PNG, JPG, or SVG up to 10 MB"
              value={diagramFile}
              disabled={isBusy}
              onChange={(val) => form.setValue("diagramFile", val, { shouldValidate: true })}
              onFileAdded={(item) => addFile(item)}
              onFileRemoved={(id) => removeFile(id)}
              uploadState={diagramFile ? uploadStates[diagramFile.clientFileId] : undefined}
            />
          </div>
        </section>

        {/* 3. Options (A, B, C, D) and Correct Answer */}
        <section className="rounded-xl border bg-background/50 p-4 space-y-3">
          <OptionsEditor
            options={options}
            correctOption={correctOption}
            disabled={isBusy}
            onOptionsChange={(newOptions) =>
              form.setValue("options", newOptions, { shouldValidate: true })
            }
            onCorrectOptionChange={(key) =>
              form.setValue("correctOption", key, { shouldValidate: true })
            }
            errors={{
              0: form.formState.errors.options?.[0]?.text?.message,
              1: form.formState.errors.options?.[1]?.text?.message,
              2: form.formState.errors.options?.[2]?.text?.message,
              3: form.formState.errors.options?.[3]?.text?.message,
            }}
          />
          {form.formState.errors.options?.message && (
            <p className="text-xs text-destructive">
              {form.formState.errors.options.message}
            </p>
          )}
          {form.formState.errors.correctOption && (
            <p className="text-xs text-destructive">
              {form.formState.errors.correctOption.message}
            </p>
          )}
        </section>

        {/* 4. Marks and Difficulty */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Controller
            name="marks"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="marks" className="text-sm font-semibold">
                  Marks
                </FieldLabel>
                <Input
                  {...field}
                  id="marks"
                  type="number"
                  min={1}
                  max={100}
                  disabled={isBusy}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  aria-invalid={fieldState.invalid}
                  className="h-9 font-mono"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="difficulty"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="difficulty" className="text-sm font-semibold">
                  Difficulty Level
                </FieldLabel>
                <NativeSelect
                  id="difficulty"
                  value={field.value}
                  disabled={isBusy}
                  onChange={(e) =>
                    field.onChange(e.target.value as QuestionDifficulty)
                  }
                  className="w-full h-9"
                >
                  <NativeSelectOption value="easy">Easy</NativeSelectOption>
                  <NativeSelectOption value="medium">Medium</NativeSelectOption>
                  <NativeSelectOption value="hard">Hard</NativeSelectOption>
                </NativeSelect>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </section>

        {/* 5. Hint and Solution (Text or Diagram Required) */}
        <section className="rounded-xl border bg-background/50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Lightbulb className="size-4 text-amber-500" />
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Hint & Solution
              </p>
            </div>
            <span className="text-sm text-muted-foreground">
              Either solution text or solution diagram is required *
            </span>
          </div>

          {/* Hint */}
          <Controller
            name="hint"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="hint" className="text-sm font-medium">
                  Hint (Optional)
                </FieldLabel>
                <Input
                  {...field}
                  id="hint"
                  placeholder="e.g. Remember to convert units to SI before calculating..."
                  disabled={isBusy}
                  aria-invalid={fieldState.invalid}
                  className="h-9"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {/* Solution Text */}
          <Controller
            name="solution"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="solution" className="text-sm font-medium">
                  Solution Explanation
                </FieldLabel>
                <Textarea
                  {...field}
                  id="solution"
                  rows={3}
                  disabled={isBusy}
                  placeholder="Provide a step-by-step solution..."
                  aria-invalid={fieldState.invalid}
                  className="resize-y text-sm"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {/* Solution Diagram */}
          <QuestionImagePicker
            id="solutionDiagram"
            label="Solution Diagram / Working (Optional if text is provided)"
            title="Add handwritten solution or explanatory diagram"
            description="PNG, JPG, or SVG up to 10 MB"
            value={solutionDiagramFile}
            disabled={isBusy}
            onChange={(val) => form.setValue("solutionDiagramFile", val, { shouldValidate: true })}
            onFileAdded={(item) => addFile(item)}
            onFileRemoved={(id) => removeFile(id)}
            uploadState={
              solutionDiagramFile
                ? uploadStates[solutionDiagramFile.clientFileId]
                : undefined
            }
          />
        </section>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            disabled={isBusy}
            onClick={handleReset}
            className="text-xs"
          >
            Clear Form
          </Button>

          <Button
            type="submit"
            disabled={isBusy}
            className="min-w-36 font-semibold shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving Question...
              </>
            ) : isUploading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Uploading Images ({totalProgress}%)...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 size-4" />
                Create Question
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

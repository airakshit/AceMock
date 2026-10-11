"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Loader2,
  Percent,
  Plus,
  Repeat2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SearchInput } from "@/components/patterns/search-input";
import { HierarchyFilterChips } from "@/components/patterns/hierarchy-filter-chips";
import { getDocumentsSummaryAction } from "@/features/documents/actions/get-documents-summary";
import type { DocumentWithQuestionCountProjection } from "@/features/documents/dto/projections";
import type { CurriculumOptionsProjection } from "@/features/questions/dto/projections";
import { getCurriculumOptionsAction } from "@/features/questions/actions";
import { layout } from "@/lib/design-system";
import { cn } from "@/lib/utils";

import { createCustomMockTestAction } from "../actions/create-custom-mock-test";
import type { MockTestScope } from "../dto/projections";
import {
  SCOPE_OPTIONS,
  customMockTestFormSchema,
  toCustomMockTestPayload,
  type CustomMockTestFormData,
} from "../schemas";

const DURATION_PRESETS = [
  { label: "30 mins", value: 30 },
  { label: "45 mins", value: 45 },
  { label: "60 mins", value: 60 },
  { label: "90 mins", value: 90 },
  { label: "120 mins", value: 120 },
  { label: "180 mins", value: 180 },
];

const NEGATIVE_PRESETS = [
  { label: "0% (None)", value: 0 },
  { label: "20% (1/5th)", value: 20 },
  { label: "25% (1/4th)", value: 25 },
  { label: "33% (1/3rd)", value: 33 },
  { label: "50% (1/2)", value: 50 },
];

/** Retake limits — `0` means unlimited. */
const MAX_ATTEMPT_PRESETS = [
  { label: "Unlimited", value: 0 },
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "5", value: 5 },
  { label: "10", value: 10 },
];

/** Shared chip styling for preset rows — active chips take the solid brand fill. */
function presetChipClass(active: boolean) {
  return cn(
    "rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors",
    active
      ? "border-primary bg-primary text-primary-foreground shadow-2xs"
      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
  );
}

/**
 * CustomMockTestForm — collapsible builder for student-authored mock tests.
 *
 * Documents load lazily the first time the form opens; the curriculum loads
 * only once a curriculum-backed test type (SubjectWise / SectionWise /
 * ChapterWise) is selected. Validation runs through the zod schema in
 * `../schemas` with inline field errors.
 */
export function CustomMockTestForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Picker data — documents load on first open, curriculum on demand.
  const [documents, setDocuments] = useState<
    DocumentWithQuestionCountProjection[]
  >([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [docsLoadFailed, setDocsLoadFailed] = useState(false);
  const [docsRetryNonce, setDocsRetryNonce] = useState(0);
  const docsLoadedRef = useRef(false);

  const [curriculum, setCurriculum] =
    useState<CurriculumOptionsProjection | null>(null);
  const [curriculumLoadFailed, setCurriculumLoadFailed] = useState(false);
  const [curriculumRetryNonce, setCurriculumRetryNonce] = useState(0);
  const curriculumLoadedRef = useRef(false);

  const [docSearch, setDocSearch] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CustomMockTestFormData>({
    resolver: zodResolver(customMockTestFormSchema),
    defaultValues: {
      name: "",
      documentIds: [],
      durationMinutes: 60,
      negativePercentagePerQuestion: 25,
      instructions: "",
      scope: "ioe_model",
      subjectId: "",
      sectionId: "",
      chapterId: "",
      allowUntimed: false,
      maxAttempts: 1,
    },
  });

  // Documents load once, the first time the form is opened.
  useEffect(() => {
    if (!isOpen || docsLoadedRef.current) return;
    docsLoadedRef.current = true;

    getDocumentsSummaryAction()
      .then((res) => {
        if (res.success) {
          setDocuments(res.data);
          setDocsLoadFailed(false);
        } else {
          docsLoadedRef.current = false;
          setDocsLoadFailed(true);
          toast.error(res.error.message || "Failed to load your documents.");
        }
      })
      .catch(() => {
        docsLoadedRef.current = false;
        setDocsLoadFailed(true);
        toast.error("An error occurred while loading your documents.");
      })
      .finally(() => {
        setIsLoadingDocs(false);
      });
  }, [isOpen, docsRetryNonce]);

  const watchedScope = useWatch({ control: form.control, name: "scope" });
  const watchedSubjectId = useWatch({
    control: form.control,
    name: "subjectId",
  });
  const watchedSectionId = useWatch({
    control: form.control,
    name: "sectionId",
  });
  const watchedDocumentIds = useWatch({
    control: form.control,
    name: "documentIds",
  });

  const needsSubject =
    watchedScope === "subject" ||
    watchedScope === "section" ||
    watchedScope === "chapter";
  const needsSection = watchedScope === "section" || watchedScope === "chapter";
  const needsChapter = watchedScope === "chapter";

  // Curriculum loads only once a curriculum-backed test type is chosen.
  useEffect(() => {
    if (!isOpen || !needsSubject || curriculumLoadedRef.current) return;
    curriculumLoadedRef.current = true;

    getCurriculumOptionsAction()
      .then((res) => {
        if (res.success) {
          setCurriculum(res.data.curriculum);
          setCurriculumLoadFailed(false);
        } else {
          curriculumLoadedRef.current = false;
          setCurriculumLoadFailed(true);
          toast.error(res.error.message || "Failed to load the curriculum.");
        }
      })
      .catch(() => {
        curriculumLoadedRef.current = false;
        setCurriculumLoadFailed(true);
        toast.error("An error occurred while loading the curriculum.");
      });
  }, [isOpen, needsSubject, curriculumRetryNonce]);

  // Client-side search over the full document list.
  const filteredDocuments = useMemo(() => {
    const query = docSearch.toLowerCase().trim();
    if (!query) return documents;
    return documents.filter((doc) => doc.title.toLowerCase().includes(query));
  }, [documents, docSearch]);

  const totalSelectedQuestions = useMemo(
    () =>
      documents
        .filter((doc) => watchedDocumentIds.includes(doc.id))
        .reduce((acc, doc) => acc + doc.questionCount, 0),
    [documents, watchedDocumentIds],
  );

  // Cascading options — children only appear once their parent is chosen.
  const availableSections = useMemo(
    () =>
      watchedSubjectId
        ? (curriculum?.sections ?? []).filter(
            (section) => section.subjectId === watchedSubjectId,
          )
        : [],
    [curriculum, watchedSubjectId],
  );

  const availableChapters = useMemo(
    () =>
      watchedSectionId
        ? (curriculum?.chapters ?? []).filter(
            (chapter) => chapter.sectionId === watchedSectionId,
          )
        : [],
    [curriculum, watchedSectionId],
  );

  const handleScopeChange = (next: MockTestScope) => {
    form.setValue("scope", next);

    // Drop ids the new test type no longer carries.
    if (next === "ioe_model" || next === "miscellaneous") {
      form.setValue("subjectId", "");
      form.setValue("sectionId", "");
      form.setValue("chapterId", "");
    } else if (next === "subject") {
      form.setValue("sectionId", "");
      form.setValue("chapterId", "");
    } else if (next === "section") {
      form.setValue("chapterId", "");
    }
    form.clearErrors(["subjectId", "sectionId", "chapterId"]);
  };

  const handleDocsRetry = () => {
    docsLoadedRef.current = false;
    setDocsLoadFailed(false);
    setIsLoadingDocs(true);
    setDocsRetryNonce((nonce) => nonce + 1);
  };

  const handleCurriculumRetry = () => {
    curriculumLoadedRef.current = false;
    setCurriculumLoadFailed(false);
    setCurriculumRetryNonce((nonce) => nonce + 1);
  };

  const handleReset = () => {
    form.reset();
    setDocSearch("");
    setShowInstructions(false);
  };

  const onSubmit = async (data: CustomMockTestFormData) => {
    // Question counts are client knowledge — the schema can't see them.
    if (data.documentIds.length > 0 && totalSelectedQuestions === 0) {
      form.setError("documentIds", {
        message: "The selected documents have no extracted questions yet.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createCustomMockTestAction(
        toCustomMockTestPayload(data),
      );

      if (!res.success) {
        toast.error(res.error.message || "Failed to create the custom test.");
        return;
      }

      toast.success(
        res.message ||
          `Custom test "${res.data.name}" created with ${res.data.totalQuestions} questions.`,
        {
          action: {
            label: "Start",
            onClick: () => router.push(`/mocks/${res.data.id}/attempt`),
          },
        },
      );
      handleReset();
      router.refresh();
      // The "Your tests" list below re-runs its search in place — a plain
      // router.refresh() would only change its hydration seed, which the
      // mounted list deliberately ignores.
      window.dispatchEvent(new Event("mocks:refresh"));
    } catch {
      toast.error("Unexpected error creating the custom test.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="w-full overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-card"
    >
      {/* Header */}
      <div
        className={cn(
          "flex w-full items-center justify-between gap-3 p-5 transition-colors hover:bg-muted/40 sm:p-6",
          isOpen && "border-b",
        )}
      >
        <CollapsibleTrigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 text-left select-none focus:outline-none">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand">
            <Sparkles className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-heading text-lg font-bold tracking-tight sm:text-xl">
              Create Custom Test
            </span>
            <span className="block truncate text-sm text-muted-foreground">
              Build a mock test from your own uploaded documents
            </span>
          </span>

          {!isOpen && watchedDocumentIds.length > 0 && (
            <span className="ml-1 inline-flex shrink-0 items-center rounded-full bg-brand-muted px-3 py-1 text-sm font-medium text-brand">
              {watchedDocumentIds.length}{" "}
              {watchedDocumentIds.length === 1 ? "document" : "documents"}
            </span>
          )}
        </CollapsibleTrigger>

        <CollapsibleTrigger
          aria-label={
            isOpen ? "Collapse custom test form" : "Expand custom test form"
          }
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center text-muted-foreground focus:outline-none"
        >
          {isOpen ? (
            <ChevronUp className="size-5" />
          ) : (
            <ChevronDown className="size-5" />
          )}
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="p-5 pt-7 sm:p-8">
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className={cn(layout.fieldStack, "space-y-8")}
          >
            <FieldGroup className={cn(layout.fieldStack, "space-y-6")}>
              {/* Test name */}
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="min-w-0">
                    <FieldLabel htmlFor="custom-mock-name">
                      Test name <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      {...field}
                      id="custom-mock-name"
                      placeholder="e.g. Physics Mechanics Practice Set"
                      aria-invalid={fieldState.invalid}
                      disabled={isSubmitting}
                      className="h-11"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              {/* Source documents — full list, client-side search */}
              <Controller
                name="documentIds"
                control={form.control}
                render={({ field, fieldState }) => {
                  const selectedIds = field.value;
                  const shownSelectable = filteredDocuments.filter(
                    (doc) => doc.questionCount > 0,
                  );

                  const toggleDoc = (docId: string) => {
                    const next = selectedIds.includes(docId)
                      ? selectedIds.filter((id) => id !== docId)
                      : [...selectedIds, docId];
                    field.onChange(next);

                    // Suggest a name for the first pick while the field is blank.
                    if (next.length > 0 && !form.getValues("name").trim()) {
                      const picked = documents.filter((doc) =>
                        next.includes(doc.id),
                      );
                      form.setValue(
                        "name",
                        picked.length === 1
                          ? `${picked[0].title} Practice Test`
                          : `Custom Test (${picked.length} Documents)`,
                      );
                    }
                  };

                  return (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="min-w-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <FieldLabel className="text-base font-semibold">
                          Documents <span className="text-destructive">*</span>
                        </FieldLabel>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={shownSelectable.length === 0}
                            onClick={() =>
                              field.onChange([
                                ...new Set([
                                  ...selectedIds,
                                  ...shownSelectable.map((doc) => doc.id),
                                ]),
                              ])
                            }
                            className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Select all
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={selectedIds.length === 0}
                            onClick={() => field.onChange([])}
                            className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Clear
                          </Button>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        Every question in the selected documents is included in
                        the test.
                      </p>

                      <SearchInput
                        value={docSearch}
                        onChange={setDocSearch}
                        placeholder="Search your documents..."
                        label="Search your documents"
                      />

                      <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border/80 bg-muted/20 p-2.5">
                        {docsLoadFailed ? (
                          <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                Couldn&apos;t load your documents.
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Check your connection and try again.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleDocsRetry}
                            >
                              Retry
                            </Button>
                          </div>
                        ) : isLoadingDocs ? (
                          <div role="status" className="space-y-2">
                            <span className="sr-only">Loading documents</span>
                            {[0, 1, 2].map((row) => (
                              <div
                                key={row}
                                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3"
                              >
                                <Skeleton className="size-4 rounded" />
                                <Skeleton className="h-4 flex-1" />
                                <Skeleton className="h-6 w-24 rounded-full" />
                              </div>
                            ))}
                          </div>
                        ) : documents.length === 0 ? (
                          <div className="py-10 text-center text-sm text-muted-foreground">
                            <p>You haven&apos;t uploaded any documents yet.</p>
                            <Link
                              href="/documents"
                              className="mt-2 inline-block text-sm font-medium text-brand hover:underline"
                            >
                              Upload documents first
                            </Link>
                          </div>
                        ) : filteredDocuments.length === 0 ? (
                          <div className="py-10 text-center text-sm text-muted-foreground">
                            No documents match &ldquo;{docSearch.trim()}
                            &rdquo;.
                          </div>
                        ) : (
                          filteredDocuments.map((doc) => {
                            const isSelected = selectedIds.includes(doc.id);
                            const hasQuestions = doc.questionCount > 0;

                            return (
                              <div
                                key={doc.id}
                                onClick={() => {
                                  if (hasQuestions) toggleDoc(doc.id);
                                }}
                                className={cn(
                                  "flex select-none items-center gap-3 rounded-xl border p-3.5 transition-colors",
                                  isSelected
                                    ? "cursor-pointer border-primary/50 bg-primary/5"
                                    : hasQuestions
                                      ? "cursor-pointer border-border/60 bg-card hover:bg-muted/50"
                                      : "cursor-not-allowed border-border/40 bg-muted/40 opacity-60",
                                )}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  disabled={!hasQuestions}
                                  onCheckedChange={() => toggleDoc(doc.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`Select ${doc.title}`}
                                />
                                <FileText
                                  className={cn(
                                    "size-4.5 shrink-0",
                                    isSelected
                                      ? "text-primary"
                                      : "text-muted-foreground",
                                  )}
                                />
                                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                  {doc.title}
                                </span>

                                {hasQuestions ? (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "h-6 shrink-0 px-2.5 text-xs font-semibold",
                                      isSelected
                                        ? "border-primary/40 bg-primary/10 text-primary"
                                        : "border-border bg-muted/50 text-muted-foreground",
                                    )}
                                  >
                                    {doc.questionCount}{" "}
                                    {doc.questionCount === 1
                                      ? "question"
                                      : "questions"}
                                  </Badge>
                                ) : (
                                  <span className="shrink-0 text-xs italic text-muted-foreground">
                                    no questions yet
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                        <span className="text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {selectedIds.length}
                          </span>{" "}
                          of {documents.length} selected
                        </span>
                        <span className="text-muted-foreground">
                          Question pool:{" "}
                          <span className="font-semibold text-brand">
                            {totalSelectedQuestions}
                          </span>{" "}
                          questions
                        </span>
                      </div>

                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  );
                }}
              />

              {/* Test type */}
              <section className="space-y-5 border-t border-border/70 pt-7">
                <div className="space-y-1.5">
                  <h3 className="font-heading text-lg font-bold tracking-tight text-foreground">
                    Test Type
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Pick the format that matches what you want to practice.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {SCOPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      title={option.hint}
                      onClick={() => handleScopeChange(option.value)}
                      disabled={isSubmitting}
                      className={presetChipClass(watchedScope === option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {needsSubject &&
                  (curriculum === null && !curriculumLoadFailed ? (
                    <HierarchyFilterChips
                      label="Subject"
                      options={[]}
                      value=""
                      onChange={() => {}}
                      loading
                      required
                    />
                  ) : curriculumLoadFailed ? (
                    <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Couldn&apos;t load the curriculum.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Check your connection and try again.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCurriculumRetry}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Controller
                        name="subjectId"
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <HierarchyFilterChips
                            label="Subject"
                            required
                            options={curriculum?.subjects ?? []}
                            value={field.value}
                            onChange={(value) => {
                              field.onChange(value);
                              // Picking a parent always invalidates its children.
                              form.setValue("sectionId", "");
                              form.setValue("chapterId", "");
                              form.clearErrors(["sectionId", "chapterId"]);
                            }}
                            disabled={isSubmitting}
                            emptyLabel="No subjects available"
                            error={
                              fieldState.invalid
                                ? fieldState.error?.message
                                : undefined
                            }
                          />
                        )}
                      />

                      {needsSection && watchedSubjectId && (
                        <Controller
                          name="sectionId"
                          control={form.control}
                          render={({ field, fieldState }) => (
                            <HierarchyFilterChips
                              label="Section"
                              required
                              options={availableSections}
                              value={field.value}
                              onChange={(value) => {
                                field.onChange(value);
                                form.setValue("chapterId", "");
                                form.clearErrors("chapterId");
                              }}
                              disabled={isSubmitting}
                              emptyLabel="No sections in this subject"
                              error={
                                fieldState.invalid
                                  ? fieldState.error?.message
                                  : undefined
                              }
                            />
                          )}
                        />
                      )}

                      {needsChapter && watchedSectionId && (
                        <Controller
                          name="chapterId"
                          control={form.control}
                          render={({ field, fieldState }) => (
                            <HierarchyFilterChips
                              label="Chapter"
                              required
                              options={availableChapters}
                              value={field.value}
                              onChange={field.onChange}
                              disabled={isSubmitting}
                              emptyLabel="No chapters in this section"
                              error={
                                fieldState.invalid
                                  ? fieldState.error?.message
                                  : undefined
                              }
                            />
                          )}
                        />
                      )}
                    </div>
                  ))}
              </section>

              {/* Rules */}
              <section className="space-y-5 border-t border-border/70 pt-7">
                <div className="space-y-1.5">
                  <h3 className="font-heading text-lg font-bold tracking-tight text-foreground">
                    Rules
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Timing, marking, and retake limits candidates see before
                    starting.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {/* Duration */}
                  <Controller
                    name="durationMinutes"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field
                        data-invalid={fieldState.invalid}
                        className="min-w-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <FieldLabel
                            htmlFor="custom-mock-duration"
                            className="flex items-center gap-1.5"
                          >
                            <Clock className="size-4 text-muted-foreground" />
                            Duration
                          </FieldLabel>
                          <span className="text-sm font-semibold text-primary">
                            {Number.isFinite(field.value)
                              ? `${field.value} min`
                              : "—"}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {DURATION_PRESETS.map((preset) => (
                            <button
                              key={preset.value}
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => field.onChange(preset.value)}
                              className={presetChipClass(
                                field.value === preset.value,
                              )}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-2">
                          <Input
                            id="custom-mock-duration"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={600}
                            value={
                              Number.isFinite(field.value) ? field.value : ""
                            }
                            onChange={(e) =>
                              field.onChange(e.target.valueAsNumber)
                            }
                            disabled={isSubmitting}
                            aria-invalid={fieldState.invalid}
                            className="h-9 w-24"
                          />
                          <span className="text-sm text-muted-foreground">
                            minutes (1–600)
                          </span>
                        </div>

                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  {/* Negative marking */}
                  <Controller
                    name="negativePercentagePerQuestion"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field
                        data-invalid={fieldState.invalid}
                        className="min-w-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <FieldLabel
                            htmlFor="custom-mock-negative"
                            className="flex items-center gap-1.5"
                          >
                            <Percent className="size-4 text-muted-foreground" />
                            Negative marking
                          </FieldLabel>
                          <span className="text-sm font-semibold text-foreground">
                            {Number.isFinite(field.value)
                              ? `${field.value}% per wrong answer`
                              : "—"}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {NEGATIVE_PRESETS.map((preset) => (
                            <button
                              key={preset.value}
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => field.onChange(preset.value)}
                              className={presetChipClass(
                                field.value === preset.value,
                              )}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-2">
                          <Input
                            id="custom-mock-negative"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100}
                            value={
                              Number.isFinite(field.value) ? field.value : ""
                            }
                            onChange={(e) =>
                              field.onChange(e.target.valueAsNumber)
                            }
                            disabled={isSubmitting}
                            aria-invalid={fieldState.invalid}
                            className="h-9 w-20"
                          />
                          <span className="text-sm text-muted-foreground">
                            % (0–100)
                          </span>
                        </div>

                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  {/* Untimed practice */}
                  <Controller
                    name="allowUntimed"
                    control={form.control}
                    render={({ field }) => (
                      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 p-4">
                        <div className="min-w-0 space-y-1">
                          <span className="text-sm font-medium">
                            Allow untimed test
                          </span>
                        </div>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isSubmitting}
                          aria-label="Allow untimed test"
                        />
                      </div>
                    )}
                  />

                  {/* Max attempts */}
                  <Controller
                    name="maxAttempts"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field
                        data-invalid={fieldState.invalid}
                        className="min-w-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <FieldLabel
                            htmlFor="custom-mock-attempts"
                            className="flex items-center gap-1.5"
                          >
                            <Repeat2 className="size-4 text-muted-foreground" />
                            Max attempts
                          </FieldLabel>
                          <span className="text-sm font-semibold text-primary">
                            {Number.isFinite(field.value)
                              ? field.value === 0
                                ? "Unlimited"
                                : `${field.value} ${field.value === 1 ? "attempt" : "attempts"}`
                              : "—"}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {MAX_ATTEMPT_PRESETS.map((preset) => (
                            <button
                              key={preset.value}
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => field.onChange(preset.value)}
                              className={presetChipClass(
                                field.value === preset.value,
                              )}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>

                        {field.value !== 0 && (
                          <div className="flex items-center gap-2">
                            <Input
                              id="custom-mock-attempts"
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={100}
                              value={
                                Number.isFinite(field.value) ? field.value : ""
                              }
                              onChange={(e) =>
                                field.onChange(e.target.valueAsNumber)
                              }
                              disabled={isSubmitting}
                              aria-invalid={fieldState.invalid}
                              className="h-9 w-20"
                            />
                          </div>
                        )}

                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </div>

                {/* Instructions — progressive disclosure */}
                {showInstructions ? (
                  <Controller
                    name="instructions"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field
                        data-invalid={fieldState.invalid}
                        className="min-w-0"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <FieldLabel htmlFor="custom-mock-instructions">
                            Instructions
                          </FieldLabel>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              form.setValue("instructions", "");
                              setShowInstructions(false);
                            }}
                            disabled={isSubmitting}
                            className="h-8 shrink-0 px-2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="size-4" />
                            <span className="hidden text-xs sm:inline">
                              Remove
                            </span>
                          </Button>
                        </div>
                        <Textarea
                          id="custom-mock-instructions"
                          rows={3}
                          placeholder="e.g. Calculator allowed. Read every question carefully."
                          value={field.value}
                          onChange={field.onChange}
                          disabled={isSubmitting}
                          aria-invalid={fieldState.invalid}
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
                    onClick={() => setShowInstructions(true)}
                    disabled={isSubmitting}
                    className="h-9 w-full border-dashed text-sm sm:w-fit"
                  >
                    <Plus className="size-4" />
                    Add instructions
                  </Button>
                )}
              </section>
            </FieldGroup>

            {/* Actions */}
            <div className="flex flex-col gap-3 border-t border-border/70 pt-7 sm:flex-row">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 flex-1 text-base font-semibold shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 size-4" />
                    Create Custom Test
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isSubmitting}
                className="h-12 px-6 text-sm"
              >
                <RotateCcw className="size-4" />
                Reset
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
                className="h-12 px-6 text-sm text-muted-foreground hover:text-foreground"
              >
                Close
              </Button>
            </div>
          </form>
        </div>

        <div className="border-t px-5 py-4 text-sm text-muted-foreground sm:px-8">
          Total marks are calculated automatically from the questions in your
          selected documents.
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

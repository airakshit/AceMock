"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import {
  RefreshCw,
  Search,
  BookOpen,
  HelpCircle,
  Layers,
  FileText,
  Filter,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { SearchInput } from "@/components/patterns/search-input";
import { EmptyState } from "@/components/patterns/empty-state";
import { QuestionCard } from "../../../shared/components/question-card/QuestionCard";
import type {
  QuestionCardType,
  OptionKey,
  QuestionMode,
} from "../../../shared/components/question-card/types";
import { getRecentQuestionsAction } from "../../actions/get-questions";
import { getRecentDocumentsForFilterAction } from "../../actions";
import type {
  QuestionDetailsProjection,
  DocumentWithQuestionCountProjection,
} from "../../dto/projections";
import { cn } from "@/lib/utils";

export function QuestionsAdminTestView() {
  const [questions, setQuestions] = useState<QuestionDetailsProjection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Document filter state
  const [documentIdInput, setDocumentIdInput] = useState<string>("");
  const [activeDocumentId, setActiveDocumentId] = useState<string>("");
  const [activeDocumentTitle, setActiveDocumentTitle] = useState<string | null>(
    null,
  );
  const [recentDocs, setRecentDocs] = useState<
    DocumentWithQuestionCountProjection[]
  >([]);

  // Filter & Display state
  const [mode, setMode] = useState<QuestionMode>("review");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [limit, setLimit] = useState<number>(50);
  const [answers, setAnswers] = useState<Record<string, OptionKey | null>>({});

  const fetchQuestions = async (
    questionLimit: number = limit,
    docId: string = activeDocumentId,
    opts?: { silent?: boolean },
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getRecentQuestionsAction({
        limit: questionLimit,
        documentId: docId || undefined,
      });

      if (res.success && res.data) {
        setQuestions(res.data.questions);
        const title =
          res.data.questions.length > 0
            ? res.data.questions[0].documentTitle
            : null;
        setActiveDocumentTitle(title || null);
        // Initial loads and filter changes communicate state in-place
        // (skeletons, banners, empty states) — keep toasts for explicit actions.
        if (!opts?.silent) {
          if (res.data.questions.length === 0) {
            if (docId) {
              toast.info(
                `No questions found for document ID: ${docId.slice(0, 8)}...`,
              );
            } else {
              toast.info("No questions found in the database.");
            }
          } else {
            toast.success(
              `Loaded ${res.data.questions.length} questions${docId ? ` for document` : ""}.`,
            );
          }
        }
      } else if (!res.success) {
        const errorMsg = res.error?.message || "Failed to load questions.";
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load: parse URL search params and fetch recent documents
  useEffect(() => {
    let initialDocId = "";
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      initialDocId = params.get("documentId")?.trim() || "";
    }

    if (initialDocId) {
      setDocumentIdInput(initialDocId);
      setActiveDocumentId(initialDocId);
      fetchQuestions(limit, initialDocId, { silent: true });
    } else {
      fetchQuestions(limit, "", { silent: true });
    }

    // Load available recent documents with question counts for quick filtering
    getRecentDocumentsForFilterAction().then((res) => {
      if (res.success && res.data) {
        setRecentDocs(res.data.documents);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const handleApplyDocumentFilter = (docIdToApply: string) => {
    const trimmed = docIdToApply.trim();
    setActiveDocumentId(trimmed);
    setSelectedSubject("all");
    setSearchQuery("");

    // Sync with URL query parameter
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (trimmed) {
        params.set("documentId", trimmed);
      } else {
        params.delete("documentId");
      }
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState(null, "", newUrl);
    }

    fetchQuestions(limit, trimmed, { silent: true });
  };

  const handleClearDocumentFilter = () => {
    setDocumentIdInput("");
    setActiveDocumentId("");
    setActiveDocumentTitle(null);
    setSelectedSubject("all");
    setSearchQuery("");

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("documentId");
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState(null, "", newUrl);
    }

    fetchQuestions(limit, "", { silent: true });
  };

  const handleRefresh = () => {
    startTransition(async () => {
      await fetchQuestions(limit, activeDocumentId);
    });
  };

  const handleAnswerChange = (questionId: string, key: OptionKey) => {
    setAnswers((prev) => ({ ...prev, [questionId]: key }));
  };

  // Extract distinct subjects
  const subjectOptions = useMemo(() => {
    const subjects = new Set<string>();
    questions.forEach((q) => {
      const subject = q.subjectSlug || q.subjectName;
      if (subject) {
        subjects.add(subject.toLowerCase());
      }
    });
    return Array.from(subjects);
  }, [questions]);

  // Filtered questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const subject = (
        q.subjectSlug ||
        q.subjectName ||
        "general"
      ).toLowerCase();
      const matchesSubject =
        selectedSubject === "all" || subject === selectedSubject.toLowerCase();

      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        q.question?.toLowerCase().includes(query) ||
        q.chapterName?.toLowerCase().includes(query) ||
        q.sectionName?.toLowerCase().includes(query) ||
        q.subjectName?.toLowerCase().includes(query) ||
        q.documentTitle?.toLowerCase().includes(query) ||
        q.fileName?.toLowerCase().includes(query) ||
        q.id.toLowerCase().includes(query);

      return matchesSubject && matchesSearch;
    });
  }, [questions, selectedSubject, searchQuery]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* ─── Top Control Panel ─── */}
      <div className="rounded-2xl border bg-card/60 backdrop-blur-sm p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Badge
            variant="outline"
            className="w-fit font-mono text-xs"
            title="Questions are served directly from the database"
          >
            Backend Live
          </Badge>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Mode Switcher */}
            <div
              role="group"
              aria-label="Question display mode"
              className="inline-flex rounded-lg border bg-muted/40 p-0.5"
            >
              <button
                type="button"
                onClick={() => setMode("exam")}
                aria-pressed={mode === "exam"}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                  mode === "exam"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Exam Mode
              </button>
              <button
                type="button"
                onClick={() => setMode("review")}
                aria-pressed={mode === "review"}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                  mode === "review"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Review Mode
              </button>
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing}
              className="gap-1.5 text-xs font-medium cursor-pointer"
            >
              <RefreshCw
                className={cn(
                  "size-3.5",
                  (isLoading || isRefreshing) && "animate-spin text-primary",
                )}
              />
              {isLoading || isRefreshing ? "Fetching..." : "Refresh"}
            </Button>

            {/* Link to Documents */}
            <Link
              href="/documents"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "gap-1.5 text-xs font-medium",
              )}
            >
              <Layers className="size-3.5" />
              Go to Documents
            </Link>
          </div>
        </div>

        {/* ─── Document ID Filter Bar ─── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-3 rounded-xl bg-muted/35 border border-border/70">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground shrink-0">
            <FileText className="size-4 text-primary" />
            <span>Filter by Document:</span>
          </div>

          <div className="relative flex-1 min-w-0">
            <Input
              placeholder="Paste Document ID (UUID)..."
              value={documentIdInput}
              onChange={(e) => setDocumentIdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleApplyDocumentFilter(documentIdInput);
                }
              }}
              className="font-mono text-xs h-8 bg-background pr-8"
            />
            {documentIdInput && (
              <button
                type="button"
                onClick={() => {
                  setDocumentIdInput("");
                  if (activeDocumentId) {
                    handleClearDocumentFilter();
                  }
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Clear input"
                aria-label="Clear document ID input"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={() => handleApplyDocumentFilter(documentIdInput)}
              disabled={
                isLoading ||
                isRefreshing ||
                !documentIdInput.trim() ||
                documentIdInput.trim() === activeDocumentId
              }
              className="h-8 text-xs font-medium gap-1 px-3 cursor-pointer"
            >
              <Filter className="size-3" />
              Load
            </Button>

            {/* Quick dropdown for recent documents */}
            {recentDocs.length > 0 && (
              <NativeSelect
                value={activeDocumentId}
                onChange={(e) => {
                  const val = e.target.value;
                  setDocumentIdInput(val);
                  handleApplyDocumentFilter(val);
                }}
                aria-label="Select a recent document"
                className="min-w-0 flex-1 sm:max-w-60 sm:flex-none"
              >
                <NativeSelectOption value="">
                  Or select recent document...
                </NativeSelectOption>
                {recentDocs.map((doc) => (
                  <NativeSelectOption key={doc.id} value={doc.id}>
                    {doc.title} ({doc.questionCount} Qs)
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}

            {activeDocumentId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearDocumentFilter}
                className="h-8 text-xs text-muted-foreground hover:text-destructive gap-1 px-2 cursor-pointer"
              >
                <X className="size-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* ─── Active Document Filter Banner ─── */}
        {activeDocumentId && (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg bg-primary/10 border border-primary/20 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Badge
                variant="default"
                className="text-[10px] px-1.5 py-0 h-4 shrink-0"
              >
                Document Filter
              </Badge>
              <span className="font-semibold text-foreground truncate">
                {activeDocumentTitle || "Document"}
              </span>
              <span
                className="font-mono text-muted-foreground text-[11px] truncate max-w-40 sm:max-w-none"
                title={activeDocumentId}
              >
                ({activeDocumentId})
              </span>
              <span className="text-muted-foreground font-medium shrink-0">
                • {questions.length} questions
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearDocumentFilter}
              className="text-primary hover:text-primary/80 font-medium underline text-[11px] shrink-0 cursor-pointer"
            >
              Show all questions
            </button>
          </div>
        )}

        {/* Filters & Search Row */}
        <div className="flex flex-col items-start gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center">
          {/* Search Input */}
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by question text, chapter, document, or ID..."
            label="Search questions"
            className="w-full sm:flex-1 sm:min-w-0"
          />

          {/* Subject Pills */}
          <div
            role="group"
            aria-label="Filter questions by subject"
            className="flex w-full items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar sm:w-auto sm:pb-0"
          >
            <button
              type="button"
              onClick={() => setSelectedSubject("all")}
              aria-pressed={selectedSubject === "all"}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                selectedSubject === "all"
                  ? "bg-brand text-brand-foreground font-semibold shadow-sm"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              All ({questions.length})
            </button>
            {subjectOptions.map((subj) => {
              const count = questions.filter(
                (q) =>
                  (
                    q.subjectSlug ||
                    q.subjectName ||
                    "general"
                  ).toLowerCase() === subj.toLowerCase(),
              ).length;
              return (
                <button
                  key={subj}
                  type="button"
                  onClick={() => setSelectedSubject(subj)}
                  aria-pressed={selectedSubject === subj}
                  className={cn(
                    "shrink-0 capitalize rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                    selectedSubject === subj
                      ? "bg-brand text-brand-foreground font-semibold shadow-sm"
                      : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {subj} ({count})
                </button>
              );
            })}
          </div>

          {/* Limit Selector */}
          <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <label htmlFor="questions-limit">Limit:</label>
            <NativeSelect
              id="questions-limit"
              size="sm"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-auto"
            >
              <NativeSelectOption value={20}>20</NativeSelectOption>
              <NativeSelectOption value={50}>50</NativeSelectOption>
              <NativeSelectOption value={100}>100</NativeSelectOption>
              <NativeSelectOption value={200}>200</NativeSelectOption>
              <NativeSelectOption value={500}>500</NativeSelectOption>
            </NativeSelect>
          </div>
        </div>
      </div>

      {/* ─── Error Alert ─── */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchQuestions(limit, activeDocumentId)}
            className="text-xs"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* ─── Content State: Loading Skeleton ─── */}
      {isLoading && (
        <div role="status" aria-label="Loading questions" className="space-y-4">
          <span className="sr-only">Loading questions...</span>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border bg-card p-5 space-y-4 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-8 rounded-lg" />
                  <Skeleton className="h-5 w-20 rounded-md" />
                </div>
                <Skeleton className="h-4 w-16 rounded" />
              </div>
              <Skeleton className="h-10 w-3/4 rounded" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Content State: Empty State ─── */}
      {!isLoading && filteredQuestions.length === 0 && (
        <EmptyState
          icon={
            activeDocumentId || searchQuery || selectedSubject !== "all"
              ? Search
              : BookOpen
          }
          title={
            activeDocumentId
              ? "No questions found for this document"
              : questions.length === 0
                ? "No questions in the database yet"
                : "No matching questions"
          }
          description={
            activeDocumentId
              ? `The document may still be processing, or it has no extracted questions yet.`
              : questions.length === 0
                ? "Upload an exam paper on the Documents page and run extraction to populate the question bank."
                : "No questions match your current search or filter criteria. Try adjusting your query."
          }
        >
          {activeDocumentId ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearDocumentFilter}
                className="text-xs"
              >
                Clear Document Filter
              </Button>
              <Link
                href="/documents"
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "text-xs inline-flex items-center gap-1.5",
                )}
              >
                <Layers className="size-3.5" />
                View in Documents
              </Link>
            </>
          ) : questions.length === 0 ? (
            <Link
              href="/documents"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "inline-flex items-center gap-1.5 text-xs",
              )}
            >
              <Layers className="size-3.5" />
              Go to Documents Page
            </Link>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedSubject("all");
              }}
              className="text-xs"
            >
              Clear Filters
            </Button>
          )}
        </EmptyState>
      )}

      {/* ─── Content State: Questions List ─── */}
      {!isLoading && filteredQuestions.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1 font-mono">
            <span>
              Showing {filteredQuestions.length} of {questions.length} total
              questions
              {activeDocumentId && " (from filtered document)"}
            </span>
            <span>
              Mode:{" "}
              <strong className="text-foreground capitalize">{mode}</strong>
            </span>
          </div>

          {filteredQuestions.map((q, idx) => {
            const rawOptions = (
              Array.isArray(q.options) ? q.options : []
            ) as Array<{
              key?: string;
              content?: string;
              text?: string;
            }>;

            const formattedOptions = rawOptions.map((opt, oIdx) => {
              const keys = ["A", "B", "C", "D"] as const;
              const key = (opt.key || keys[oIdx] || "A") as OptionKey;
              const content = opt.content || opt.text || "";
              return {
                key,
                content,
                isCorrect: key === q.correctOption,
              };
            });

            const cardData: QuestionCardType = {
              id: q.id,
              subject: (q.subjectSlug || "general").toLowerCase(),
              difficulty: q.difficulty,
              questionText: q.question,
              options: formattedOptions,
              correctOption: (q.correctOption || "A") as OptionKey,
              explanation: q.solution || undefined,
              marks: q.marks,
              negativeMarks: 0,
              diagramUrl: q.questionDiagram,
              solutionDiagramUrl: q.solutionDiagram,
            };

            return (
              <div key={q.id} className="space-y-2">
                {/* Curriculum Context Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs px-2 text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-medium flex-wrap">
                    <span className="text-foreground">{q.subjectName}</span>
                    {q.sectionName && (
                      <>
                        <span className="opacity-40">/</span>
                        <span>{q.sectionName}</span>
                      </>
                    )}
                    {q.chapterName && (
                      <>
                        <span className="opacity-40">/</span>
                        <span className="text-primary font-semibold">
                          {q.chapterName}
                        </span>
                      </>
                    )}
                    {q.documentTitle && (
                      <>
                        <span className="opacity-40">•</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (q.documentId) {
                              setDocumentIdInput(q.documentId);
                              handleApplyDocumentFilter(q.documentId);
                            }
                          }}
                          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title={`Click to filter by Document ID: ${q.documentId || ""}`}
                        >
                          <FileText className="size-3 text-muted-foreground" />
                          <span className="truncate max-w-45 sm:max-w-60">
                            {q.documentTitle}
                          </span>
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[11px] opacity-75 shrink-0">
                    <span title={q.id}>ID: {q.id.slice(0, 8)}...</span>
                  </div>
                </div>

                {/* Actual Question Card */}
                <QuestionCard
                  question={cardData}
                  questionNumber={idx + 1}
                  mode={mode}
                  selectedAnswer={answers[q.id] ?? null}
                  onAnswerChange={(key) => handleAnswerChange(q.id, key)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

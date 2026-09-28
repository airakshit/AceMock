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
import { QuestionCard } from "./question-card/QuestionCard";
import type {
  QuestionCardType,
  OptionKey,
  QuestionMode,
} from "./question-card/types";
import {
  getRecentQuestionsAction,
} from "../actions/get-questions";
import { getRecentDocumentsForFilterAction } from "../actions";
import { QuestionItemDTO, DocumentFilterOptionDTO } from "../actions/types";
import { cn } from "@/lib/utils";

export function QuestionsTestView() {
  const [questions, setQuestions] = useState<QuestionItemDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Document filter state
  const [documentIdInput, setDocumentIdInput] = useState<string>("");
  const [activeDocumentId, setActiveDocumentId] = useState<string>("");
  const [activeDocumentTitle, setActiveDocumentTitle] = useState<string | null>(null);
  const [recentDocs, setRecentDocs] = useState<DocumentFilterOptionDTO[]>([]);

  // Filter & Display state
  const [mode, setMode] = useState<QuestionMode>("review");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [limit, setLimit] = useState<number>(50);
  const [answers, setAnswers] = useState<Record<string, OptionKey | null>>({});

  const fetchQuestions = async (
    questionLimit: number = limit,
    docId: string = activeDocumentId,
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
        setActiveDocumentTitle(res.data.documentTitle || null);
        if (res.data.questions.length === 0) {
          if (docId) {
            toast.info(`No questions found for document ID: ${docId.slice(0, 8)}...`);
          } else {
            toast.info("No questions found in the database.");
          }
        } else {
          toast.success(
            `Loaded ${res.data.questions.length} questions${docId ? ` for document` : ""}.`,
          );
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
      fetchQuestions(limit, initialDocId);
    } else {
      fetchQuestions(limit, "");
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

    fetchQuestions(limit, trimmed);
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

    fetchQuestions(limit, "");
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
      if (q.subject) {
        subjects.add(q.subject.toLowerCase());
      }
    });
    return Array.from(subjects);
  }, [questions]);

  // Filtered questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchesSubject =
        selectedSubject === "all" ||
        q.subject.toLowerCase() === selectedSubject.toLowerCase();

      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        q.questionText?.toLowerCase().includes(query) ||
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">
                Question Bank Testing View
              </h2>
              <Badge variant="outline" className="font-mono text-xs">
                Backend Live
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Testing view for questions extracted and persisted via the OCR
              workflow.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Mode Switcher */}
            <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setMode("exam")}
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
              <select
                value={activeDocumentId}
                onChange={(e) => {
                  const val = e.target.value;
                  setDocumentIdInput(val);
                  handleApplyDocumentFilter(val);
                }}
                className="h-8 max-w-[200px] sm:max-w-[240px] bg-background border rounded-md px-2 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer truncate"
              >
                <option value="">Or select recent document...</option>
                {recentDocs.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} ({doc.questionCount} Qs)
                  </option>
                ))}
              </select>
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
              <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                Document Filter
              </Badge>
              <span className="font-semibold text-foreground truncate">
                {activeDocumentTitle || "Document"}
              </span>
              <span
                className="font-mono text-muted-foreground text-[11px] truncate max-w-[160px] sm:max-w-none"
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
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-border/60">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by question text, chapter, document, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm h-9 bg-background/80"
            />
          </div>

          {/* Subject Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedSubject("all")}
              className={cn(
                "px-2.5 py-1 text-xs rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap",
                selectedSubject === "all"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground",
              )}
            >
              All ({questions.length})
            </button>
            {subjectOptions.map((subj) => {
              const count = questions.filter(
                (q) => q.subject.toLowerCase() === subj.toLowerCase(),
              ).length;
              return (
                <button
                  key={subj}
                  type="button"
                  onClick={() => setSelectedSubject(subj)}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-full font-medium transition-colors cursor-pointer capitalize whitespace-nowrap",
                    selectedSubject === subj
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted/70 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {subj} ({count})
                </button>
              );
            })}
          </div>

          {/* Limit Selector */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <span>Limit:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-background border rounded-md px-2 py-1 text-xs font-medium cursor-pointer"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
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
        <div className="space-y-4">
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
        <div className="rounded-2xl border border-dashed bg-card/40 p-12 text-center space-y-4">
          <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <BookOpen className="size-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-semibold">No questions found</h3>
            <p className="text-sm text-muted-foreground">
              {activeDocumentId
                ? `No questions found for document ID "${activeDocumentId}". The document may still be processing, or has no extracted questions yet.`
                : questions.length === 0
                  ? "There are currently no questions stored in the database. Go to the Documents page, upload an exam paper, and click 'Process' to extract questions."
                  : "No questions match your current search or filter criteria. Try adjusting your query."}
            </p>
          </div>
          {activeDocumentId ? (
            <div className="flex items-center justify-center gap-2 pt-1">
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
            </div>
          ) : questions.length === 0 ? (
            <Link
              href="/documents"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "mt-2 inline-flex items-center gap-2",
              )}
            >
              <Layers className="size-4" />
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
              className="mt-2 text-xs"
            >
              Clear Filters
            </Button>
          )}
        </div>
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
              Mode: <strong className="text-foreground capitalize">{mode}</strong>
            </span>
          </div>

          {filteredQuestions.map((q, idx) => {
            const cardData: QuestionCardType = {
              id: q.id,
              subject: q.subject,
              questionText: q.questionText,
              options: q.options,
              correctOption: q.correctOption as OptionKey,
              explanation: q.explanation,
              marks: q.marks,
              negativeMarks: q.negativeMarks,
              diagramUrl: q.diagramUrl,
              solutionDiagramUrl: q.solutionDiagramUrl,
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
                          <span className="truncate max-w-[180px] sm:max-w-[240px]">
                            {q.documentTitle}
                          </span>
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[11px] opacity-75 shrink-0">
                    {q.difficulty && (
                      <span className="capitalize">{q.difficulty}</span>
                    )}
                    <span>•</span>
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

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Loader2,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { getAttemptReviewSummaryAction } from "../../actions/get-attempt-review-summary";
import { getReviewQuestionAction } from "../../actions/get-review-question";
import type { AttemptReviewSummaryResult } from "../../dto/results";
import type { ReviewQuestionResult } from "../../dto/projections";
import { QuestionCard } from "@/features/shared/components/question-card/QuestionCard";
import type {
  QuestionCardType,
  OptionKey,
  PassageType,
} from "@/features/shared/components/question-card/types";
import { QuestionPalette, type PaletteQuestionResult } from "./QuestionPalette";

interface MockAttemptReviewClientProps {
  attemptId: string;
}

function QuestionSkeleton() {
  return (
    <div
      className="space-y-4 animate-pulse"
      aria-busy="true"
      aria-label="Loading question"
    >
      <div className="h-6 bg-muted rounded w-1/4" />
      <div className="h-8 bg-muted rounded w-3/4" />
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-5/6" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function MockAttemptReviewClient({
  attemptId,
}: MockAttemptReviewClientProps) {
  const router = useRouter();

  // Summary loaded on mount
  const [summary, setSummary] = useState<AttemptReviewSummaryResult | null>(
    null,
  );
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Current question index (0-based in summary.index)
  const [currentIndex, setCurrentIndex] = useState(0);

  // Question cache: position -> ReviewQuestionResult
  const [questionCache, setQuestionCache] = useState<
    Record<number, ReviewQuestionResult>
  >({});
  // Question errors: position -> error message
  const [questionErrors, setQuestionErrors] = useState<Record<number, string>>(
    {},
  );
  // Track in-flight fetches to avoid double-requests
  const fetchingRef = useRef<Set<number>>(new Set());

  // Mobile palette sheet
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Retry nonce for question fetch
  const [questionRetryNonce, setQuestionRetryNonce] = useState(0);

  // Scroll into view on index change
  const questionAreaRef = useRef<HTMLDivElement | null>(null);

  // ------------------------------------------------------------------
  // Load summary on mount
  // ------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    getAttemptReviewSummaryAction(attemptId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setSummary(res.data);
          setSummaryError(null);
        } else {
          setSummaryError(
            res.error.message || "Failed to load attempt review.",
          );
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setSummaryError("An error occurred while loading the review.");
      });

    return () => {
      isMounted = false;
    };
  }, [attemptId]);

  // ------------------------------------------------------------------
  // Load question on demand when index changes (or retry)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!summary) return;
    const item = summary.index[currentIndex];
    if (!item) return;

    const position = item.position;
    if (questionCache[position] || fetchingRef.current.has(position)) return;

    let isMounted = true;
    fetchingRef.current.add(position);

    getReviewQuestionAction(attemptId, position)
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setQuestionCache((prev) => ({ ...prev, [position]: res.data }));
          setQuestionErrors((prev) => {
            const next = { ...prev };
            delete next[position];
            return next;
          });
        } else {
          setQuestionErrors((prev) => ({
            ...prev,
            [position]: res.error.message,
          }));
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setQuestionErrors((prev) => ({
          ...prev,
          [position]: "An error occurred while loading this question.",
        }));
      })
      .finally(() => {
        fetchingRef.current.delete(position);
      });

    return () => {
      isMounted = false;
    };
  }, [attemptId, summary, currentIndex, questionCache, questionRetryNonce]);

  // Scroll to question area on index change
  useEffect(() => {
    if (!summary) return;
    questionAreaRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [currentIndex, summary]);

  // ------------------------------------------------------------------
  // Derived state
  // ------------------------------------------------------------------
  const index = summary?.index ?? [];
  const currentItem = index[currentIndex] ?? null;
  const currentPosition = currentItem?.position ?? null;
  const currentQuestion = currentPosition
    ? (questionCache[currentPosition] ?? null)
    : null;
  const currentError = currentPosition
    ? (questionErrors[currentPosition] ?? null)
    : null;
  const isLoadingQuestion =
    Boolean(currentItem) && !currentQuestion && !currentError;

  const passageById = useMemo(
    () =>
      new Map(
        (currentQuestion?.passage ? [currentQuestion.passage] : []).map((p) => [
          p.id,
          p,
        ]),
      ),
    [currentQuestion],
  );

  const currentPassage = currentQuestion?.passageId
    ? (passageById.get(currentQuestion.passageId) ?? null)
    : null;

  const passageQuestionPositions = currentPassage
    ? currentPassage.questionIds
        .map((id) => index.find((i) => i.questionId === id)?.position)
        .filter((pos): pos is number => pos !== undefined)
    : [];

  // Results map for palette (questionId -> status)
  const resultsMap = useMemo<Record<string, PaletteQuestionResult>>(
    () => Object.fromEntries(index.map((i) => [i.questionId, i.status])),
    [index],
  );

  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex >= index.length - 1;
  const answeredCount = index.filter((i) => i.status !== "unattempted").length;
  const correctCount = index.filter((i) => i.status === "correct").length;
  const incorrectCount = index.filter((i) => i.status === "incorrect").length;

  // Score display
  const scoreMarks = summary?.scoreMarks ?? 0;
  const totalMarks = summary?.mockTest.totalMarks ?? 0;
  const accuracyPercent = summary?.accuracyPercent ?? 0;

  // ------------------------------------------------------------------
  // Navigation
  // ------------------------------------------------------------------
  const goToQuestion = (index_: number) => {
    if (index_ < 0 || index_ >= index.length) return;
    setCurrentIndex(index_);
    setIsPaletteOpen(false);
  };

  // ------------------------------------------------------------------
  // Render: loading summary
  // ------------------------------------------------------------------
  if (!summary && !summaryError) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center p-6">
        <Loader2 className="size-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">Loading review...</p>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Render: summary error (in-progress, forbidden, etc.)
  // ------------------------------------------------------------------
  if (summaryError) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-border/80 bg-card p-6 text-center shadow-card">
          <XCircle className="mx-auto size-12 text-destructive mb-3" />
          <h1 className="text-lg font-semibold text-foreground mb-2">
            Cannot review this attempt
          </h1>
          <p className="text-sm text-muted-foreground mb-6">{summaryError}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/mocks/history")}
            className="gap-1.5"
          >
            <ArrowLeft />
            Back to history
          </Button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Render: review UI
  // ------------------------------------------------------------------
  const progressPercent =
    index.length > 0 ? (correctCount / index.length) * 100 : 0;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* Top bar: identity + score + navigator trigger */}
      <header className="sticky top-0 z-20 border-b border-border/80 bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-3 sm:px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Back to history"
            onClick={() => router.push("/mocks/history")}
          >
            <ArrowLeft />
          </Button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {summary!.mockTest.name}
            </p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              Question {currentIndex + 1} of {index.length} · Review
            </p>
          </div>

          {/* Mobile question navigator trigger */}
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="lg:hidden"
            aria-label="Open question navigator"
            onClick={() => setIsPaletteOpen(true)}
          >
            <LayoutGrid />
          </Button>

          {/* Score chip instead of timer */}
          <div className="flex h-8 items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-2 text-sm font-semibold text-success tabular-nums">
            <CheckCircle2 className="size-4" />
            {scoreMarks > 0 ? `+${scoreMarks}` : String(scoreMarks)}
            <span className="text-sm font-medium text-success/70">
              /{totalMarks}
            </span>
            <span className="ml-1.5 text-[11px] font-medium text-success/70">
              {accuracyPercent}%
            </span>
          </div>
        </div>

        {/* Correct progress bar */}
        <div
          className="h-1 w-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={index.length}
          aria-valuenow={correctCount}
        >
          <div
            className="h-full bg-success transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Body: question area + desktop navigator */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-3 sm:p-4 lg:flex-row lg:gap-6 lg:p-6">
        <main
          ref={questionAreaRef}
          className="min-w-0 flex-1 scroll-mt-16 space-y-4"
        >
          {isLoadingQuestion ? (
            <QuestionSkeleton />
          ) : currentError ? (
            <div className="rounded-xl border border-border/80 bg-card p-6 text-center shadow-card">
              <XCircle className="mx-auto size-10 text-destructive mb-2" />
              <p className="text-sm text-muted-foreground mb-4">
                {currentError}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuestionRetryNonce((n) => n + 1)}
                className="gap-1.5"
              >
                <Loader2 className="size-3.5" />
                Retry
              </Button>
            </div>
          ) : currentQuestion ? (
            <QuestionCard
              key={currentQuestion.questionId}
              question={{
                id: currentQuestion.questionId,
                subject: (currentQuestion.subject ??
                  "General") as QuestionCardType["subject"],
                difficulty:
                  currentQuestion.difficulty as QuestionCardType["difficulty"],
                questionText: currentQuestion.question,
                options: currentQuestion.options.map((opt) => ({
                  key: opt.key.toUpperCase() as QuestionCardType["options"][number]["key"],
                  content: opt.text,
                  isCorrect:
                    opt.key.toUpperCase() ===
                    currentQuestion.correctOption.toUpperCase(),
                })),
                correctOption:
                  currentQuestion.correctOption as QuestionCardType["correctOption"],
                explanation: currentQuestion.solution ?? undefined,
                marks: currentQuestion.marks,
                negativeMarks: currentQuestion.negativeMarks,
                diagramUrl: currentQuestion.questionDiagram ?? undefined,
                solutionDiagramUrl:
                  currentQuestion.solutionDiagram ?? undefined,
                passage: currentPassage
                  ? {
                      id: currentPassage.id,
                      content: currentPassage.content,
                      questionPositions: passageQuestionPositions,
                    }
                  : null,
              }}
              questionNumber={currentIndex + 1}
              mode="review"
              selectedAnswer={
                currentQuestion.selectedOption as OptionKey | null
              }
              onAnswerChange={() => {}}
              isBookmarked={false}
            />
          ) : null}
        </main>

        <aside className="hidden w-72 shrink-0 lg:block z-10">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
            <QuestionPalette
              questions={index.map((i) => ({
                id: i.questionId,
                questionId: i.questionId,
                position: i.position,
              }))}
              currentIndex={currentIndex}
              onSelect={goToQuestion}
              results={resultsMap}
            />
          </div>
        </aside>
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 z-30 border-t border-border/80 bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-3 sm:px-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1 sm:h-8"
            disabled={isFirstQuestion}
            onClick={() => goToQuestion(currentIndex - 1)}
          >
            <ChevronLeft />
            <span className="hidden sm:inline">Prev</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 sm:h-8"
            disabled={isLastQuestion}
            onClick={() => goToQuestion(currentIndex + 1)}
          >
            Next
            <ChevronRight />
          </Button>

          <div className="flex-1" />

          {/* Current question result chip */}
          {currentQuestion && (
            <span
              className={cn(
                "flex h-9 min-w-28 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-semibold tabular-nums",
                currentQuestion.isCorrect
                  ? "border-success/40 bg-success/10 text-success"
                  : currentQuestion.selectedOption === null
                    ? "border-muted/70 bg-muted/40 text-muted-foreground"
                    : "border-danger/40 bg-danger/10 text-danger",
              )}
            >
              {currentQuestion.isCorrect ? (
                <>
                  <CheckCircle2 className="size-3.5" />
                  {currentQuestion.marksAwarded > 0
                    ? `+${currentQuestion.marksAwarded}`
                    : String(currentQuestion.marksAwarded)}
                </>
              ) : currentQuestion.selectedOption === null ? (
                <>
                  <span className="size-3.5 flex items-center justify-center">
                    −
                  </span>
                  0
                </>
              ) : (
                <>
                  <XCircle className="size-3.5" />
                  {currentQuestion.marksAwarded < 0
                    ? String(currentQuestion.marksAwarded)
                    : `0`}
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Mobile question navigator */}
      <Sheet open={isPaletteOpen} onOpenChange={setIsPaletteOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] gap-0 overflow-hidden p-0"
        >
          <SheetTitle className="sr-only">Question navigator</SheetTitle>
          <SheetDescription className="sr-only">
            Jump to any question in the review.
          </SheetDescription>
          <div className="max-h-[85dvh] overflow-y-auto p-4 pr-12">
            <QuestionPalette
              questions={index.map((i) => ({
                id: i.questionId,
                questionId: i.questionId,
                position: i.position,
              }))}
              currentIndex={currentIndex}
              onSelect={goToQuestion}
              results={resultsMap}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

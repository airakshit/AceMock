"use client";

import { cn } from "@/lib/utils";
import type { MockAttemptQuestionProjection } from "../../dto/projections";
import type { AttemptReviewIndexItem } from "../../dto/projections";

/** Question result state for review mode palette coloring. */
export type PaletteQuestionResult = "correct" | "incorrect" | "unattempted";

/** Minimal question info needed by the palette (works for both test and review). */
export interface PaletteQuestion {
  id: string;
  questionId: string;
  position: number;
}

interface QuestionPaletteProps {
  questions: (MockAttemptQuestionProjection | PaletteQuestion)[];
  /** questionId -> confirmed option (answer saved on the server). */
  selections?: Record<string, string | null>;
  /** questionId -> review result state. Used instead of selections in review mode. */
  results?: Record<string, PaletteQuestionResult>;
  currentIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}

/**
 * Grid navigator that lets examinees jump to any question and see at a
 * glance which questions are answered / correct / incorrect.
 */
export function QuestionPalette({
  questions,
  selections = {},
  results,
  currentIndex,
  onSelect,
  className,
}: QuestionPaletteProps) {
  const isReview = Boolean(results);

  // Count states
  const answeredCount = questions.filter((q) => Boolean(selections[q.questionId])).length;
  const correctCount = isReview
    ? questions.filter((q) => results?.[q.questionId] === "correct").length
    : 0;
  const incorrectCount = isReview
    ? questions.filter((q) => results?.[q.questionId] === "incorrect").length
    : 0;
  const unattemptedCount = isReview
    ? questions.filter((q) => results?.[q.questionId] === "unattempted").length
    : 0;

  const total = questions.length;
  const progressPercent = total > 0
    ? isReview
      ? (correctCount / total) * 100
      : (answeredCount / total) * 100
    : 0;

  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4",
        className,
      )}
      aria-label="Question navigator"
    >
      <header className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Question Navigator
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {isReview
              ? `${correctCount} correct · ${incorrectCount} incorrect`
              : `${answeredCount} of ${total} answered`}
          </p>
        </div>

        <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
          {Math.round(progressPercent)}%
        </span>
      </header>

      {/* Progress bar */}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={isReview ? correctCount : answeredCount}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: isReview
              ? "var(--success)"
              : "var(--color-primary)",
          }}
        />
      </div>

      {/* Number grid */}
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6 lg:grid-cols-5">
        {questions.map((question, index) => {
          const isAnswered = Boolean(selections[question.questionId]);
          const isCurrent = index === currentIndex;
          const reviewResult = results?.[question.questionId];
          const isCorrect = reviewResult === "correct";
          const isIncorrect = reviewResult === "incorrect";

          return (
            <button
              key={question.id}
              type="button"
              onClick={() => onSelect(index)}
              aria-label={`Go to question ${index + 1}${isCorrect ? ", correct" : isIncorrect ? ", incorrect" : ", not attempted"}`}
              aria-current={isCurrent ? "true" : undefined}
              className={cn(
                "flex h-9 items-center justify-center rounded-md border text-xs font-semibold tabular-nums transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                isCurrent && isReview && isCorrect
                  ? "ring-2 ring-primary ring-offset-1 ring-offset-card border-success/60 bg-success/10 text-success"
                  : isCurrent && isReview && isIncorrect
                    ? "ring-2 ring-primary ring-offset-1 ring-offset-card border-danger/60 bg-danger/10 text-danger"
                    : isCurrent && isReview
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-card border-muted/70 bg-muted/40 text-muted-foreground"
                      : isCurrent
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : isCorrect
                          ? "border-success/40 bg-success/10 text-success hover:border-success/60"
                          : isIncorrect
                            ? "border-danger/40 bg-danger/10 text-danger hover:border-danger/60"
                            : isAnswered || isReview
                              ? "border-border/70 bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                              : "border-border/70 bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/50 pt-3 text-[10px] font-medium text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span
            className={cn(
              "size-2.5 rounded-sm",
              isReview
                ? "border-primary bg-card"
                : "bg-primary",
            )}
          />
          Current
        </li>
        {isReview ? (
          <>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-success/70" />
              Correct
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-danger/70" />
              Incorrect
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm border border-border/70 bg-muted" />
              Not attempted
            </li>
          </>
        ) : (
          <>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-success/70" />
              Answered
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm border border-border/70 bg-muted" />
              Not answered
            </li>
          </>
        )}
      </ul>
    </section>
  );
}
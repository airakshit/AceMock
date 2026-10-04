"use client";

import { ChevronRight, ClipboardCheck, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AttemptHistoryItemProjection } from "../../dto/projections";
import { formatDuration } from "../attempt/instructions";
import { formatAttemptDate, formatScore } from "./utils";

/** Attempts for one mock test, latest first. */
export interface AttemptGroup {
  mockTestId: string;
  mockTestName: string;
  attempts: AttemptHistoryItemProjection[];
}

interface MockTestAttemptsTableProps {
  group: AttemptGroup;
  /** Open the per-question breakdown of a completed attempt. */
  onOpenDetails: (attemptId: string) => void;
  /** Continue an attempt that is still in progress. */
  onResume: (mockTestId: string) => void;
}

/**
 * One independent card per mock test: the test name is the component header
 * (with attempt count, question/marks meta and best score), followed by its
 * own responsive attempts table — bold serial numbers, latest attempt first.
 * Narrow viewports scroll the table horizontally instead of dropping columns.
 */
export function MockTestAttemptsTable({
  group,
  onOpenDetails,
  onResume,
}: MockTestAttemptsTableProps) {
  const latestAttempt = group.attempts[0];
  const bestScore = group.attempts.reduce(
    (best, attempt) => Math.max(best, attempt.scoreMarks),
    Number.NEGATIVE_INFINITY,
  );
  const headingId = `mock-test-attempts-${group.mockTestId}`;

  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-card"
    >
      {/* Component header — the mock test name */}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/80 bg-muted/40 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-card text-primary">
            <ClipboardCheck className="size-4" />
          </span>
          <div className="min-w-0">
            <h2
              id={headingId}
              className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg"
            >
              {group.mockTestName}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {group.attempts.length}{" "}
              {group.attempts.length === 1 ? "attempt" : "attempts"} ·{" "}
              {latestAttempt.totalQuestions} questions ·{" "}
              {latestAttempt.totalMarks} marks
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            Best score
          </p>
          <p className="mt-0.5 text-base font-semibold text-foreground tabular-nums">
            {formatScore(bestScore)}
            <span className="text-sm font-medium text-muted-foreground">
              /{latestAttempt.totalMarks}
            </span>
          </p>
        </div>
      </header>

      {/* This mock test's attempts table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <caption className="sr-only">
            Attempts of {group.mockTestName}, newest first.
          </caption>

          <thead>
            <tr className="border-b border-border/80 bg-muted/50 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              <th scope="col" className="w-14 px-4 py-3 text-left">
                #
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                Date
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Attempted
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Correct
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Incorrect
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Unattempted
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Accuracy
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Score
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {group.attempts.map((attempt, index) => {
              const isCompleted = attempt.status === "completed";
              const durationLabel = isCompleted
                ? formatDuration(
                    Math.max(
                      0,
                      (new Date(
                        attempt.submittedAt ?? attempt.startedAt,
                      ).getTime() -
                        new Date(attempt.startedAt).getTime()) /
                        1000,
                    ),
                  )
                : null;
              const serial = String(index + 1).padStart(2, "0");

              return (
                <tr
                  key={attempt.id}
                  className="border-b border-border/50 transition-colors last:border-b-0 hover:bg-muted/30"
                >
                  {/* Bold serial number within this mock test */}
                  <td className="px-4 py-3 align-middle">
                    <span className="text-base font-bold text-foreground tabular-nums">
                      {serial}
                    </span>
                  </td>

                  {/* Date + time taken */}
                  <td className="px-4 py-3 align-middle">
                    <span className="block whitespace-nowrap text-sm text-foreground">
                      {formatAttemptDate(
                        attempt.submittedAt ?? attempt.startedAt,
                      )}
                    </span>
                    <span className="mt-0.5 block whitespace-nowrap text-xs text-muted-foreground">
                      {durationLabel
                        ? `Time taken · ${durationLabel}`
                        : "Not yet submitted"}
                    </span>
                  </td>

                  {/* Answer counts */}
                  <td className="px-4 py-3 text-right align-middle text-sm font-medium text-primary tabular-nums">
                    {attempt.attemptedCount}/{attempt.totalQuestions}
                  </td>
                  <td className="px-4 py-3 text-right align-middle text-sm font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                    {attempt.correctCount}
                  </td>
                  <td className="px-4 py-3 text-right align-middle text-sm font-semibold text-rose-600 tabular-nums dark:text-rose-400">
                    {attempt.incorrectCount}
                  </td>
                  <td className="px-4 py-3 text-right align-middle text-sm font-medium text-muted-foreground tabular-nums">
                    {attempt.unattemptedCount}
                  </td>

                  {/* Accuracy */}
                  <td className="px-4 py-3 text-right align-middle text-sm font-medium text-foreground tabular-nums">
                    {attempt.accuracyPercent}%
                  </td>

                  {/* Score */}
                  <td className="px-4 py-3 text-right align-middle">
                    <span className="whitespace-nowrap text-base font-semibold text-foreground tabular-nums">
                      {formatScore(attempt.scoreMarks)}
                      <span className="text-sm font-medium text-muted-foreground">
                        /{attempt.totalMarks}
                      </span>
                    </span>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3 text-right align-middle">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-7 gap-1 px-2.5 text-xs whitespace-nowrap",
                        isCompleted
                          ? null
                          : "border-amber-500/40 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300",
                      )}
                      onClick={() =>
                        isCompleted
                          ? onOpenDetails(attempt.id)
                          : onResume(attempt.mockTestId)
                      }
                    >
                      {isCompleted ? (
                        <>
                          View breakdown
                          <ChevronRight />
                        </>
                      ) : (
                        <>
                          <PlayCircle />
                          Resume
                        </>
                      )}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

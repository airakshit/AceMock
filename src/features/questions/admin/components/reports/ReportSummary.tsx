"use client";

import { Flag, Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { QuestionReportsSummaryResult } from "../../../dto/results";
import {
  QUESTION_REPORT_OPTIONS,
  type QuestionReportType,
} from "../../../../shared/components/question-card/types";

interface ReportSummaryProps {
  /** Null while the first load is in flight or if it failed. */
  summary: QuestionReportsSummaryResult | null;
  isLoading: boolean;
  /** Empty string = no category filter (everything shown). */
  activeReportType: QuestionReportType | "";
  onSelectReportType: (value: QuestionReportType | "") => void;
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg leading-tight font-semibold tabular-nums">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

/**
 * Headline rollup for the reports backlog, plus the category counts as a
 * clickable filter group.
 *
 * The chips render every report category (zero-filled by the service) and
 * write straight into the same `reportType` filter the select uses — so
 * the summary is not decoration, it is the fastest way into a slice of the
 * list. Counts are distinct *questions* per type; the tile above shows how
 * many raw report rows those questions drew.
 */
export function ReportSummary({
  summary,
  isLoading,
  activeReportType,
  onSelectReportType,
}: ReportSummaryProps) {
  const loading = isLoading && summary === null;

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading report summary"
        className="rounded-xl border border-border/80 bg-card p-3 shadow-card sm:p-4"
      >
        <span className="sr-only">Loading report summary...</span>
        <div className="grid grid-cols-2 gap-2.5 sm:max-w-lg">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-7 w-28 rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const chipClass = (isActive: boolean) =>
    cn(
      "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs outline-none transition-colors",
      "focus-visible:ring-2 focus-visible:ring-ring",
      "disabled:pointer-events-none disabled:opacity-60",
      isActive
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-foreground hover:bg-accent/60",
    );

  return (
    <div className="rounded-xl border border-border/80 bg-card p-3 shadow-card sm:p-4">
      <div className="grid grid-cols-2 gap-2.5 sm:max-w-lg">
        <StatTile
          label="Reported questions"
          value={summary.totalReportedQuestions}
        />
        <StatTile label="Reports received" value={summary.totalReports} />
      </div>

      <div className="mt-3 border-t border-border/60 pt-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Flag className="size-3.5" aria-hidden="true" />
          <span>Questions by report type</span>
          {isLoading && (
            <Loader2 className="size-3 animate-spin" aria-label="Refreshing" />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSelectReportType("")}
            aria-pressed={activeReportType === ""}
            disabled={isLoading}
            className={chipClass(activeReportType === "")}
          >
            <span className="font-medium">All types</span>
          </button>

          {QUESTION_REPORT_OPTIONS.map((option) => {
            const isActive = activeReportType === option.value;
            const questionCount = summary.questionCountByType[option.value];
            const reportCount = summary.reportCountByType[option.value];

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onSelectReportType(isActive ? "" : option.value)}
                aria-pressed={isActive}
                disabled={isLoading}
                title={`${reportCount.toLocaleString()} report${reportCount === 1 ? "" : "s"} under "${option.label}"`}
                className={chipClass(isActive)}
              >
                <span className="truncate font-medium">{option.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums",
                    isActive
                      ? "bg-primary-foreground/20"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {questionCount.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

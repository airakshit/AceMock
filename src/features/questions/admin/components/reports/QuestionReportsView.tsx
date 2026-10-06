"use client";

import { useEffect, useState, useTransition } from "react";
import { Flag, HelpCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/patterns/empty-state";
import {
  getQuestionReportsSummaryAction,
  searchReportedQuestionsAction,
} from "../../../actions";
import type { ReportedQuestionProjection } from "../../../dto/projections";
import type { QuestionReportsSummaryResult } from "../../../dto/results";
import {
  EMPTY_REPORT_FILTERS,
  ReportFilters,
  type ReportFiltersState,
} from "./ReportFilters";
import { ReportSummary } from "./ReportSummary";
import { ReportedQuestionItem } from "./ReportedQuestionItem";

/**
 * QuestionReportsView — the admin triage list for reported questions.
 *
 * Two independent loads:
 *
 * - the **summary** is global and all-time, fetched once on mount; its
 *   category chips write into the same `reportType` filter the list uses,
 *   so the numbers and the rows always describe the same taxonomy;
 * - the **list** is keyset/cursor paginated: `nextCursor` from each
 *   response is passed back verbatim to fetch the following page (no
 *   limit/offset), and any filter change re-runs the first page so
 *   ordering and cursors stay consistent.
 *
 * Both filters narrow *report rows*, not questions — a question appears
 * when at least one of its reports is in the window.
 */
export function QuestionReportsView() {
  const [filters, setFilters] = useState<ReportFiltersState>(
    EMPTY_REPORT_FILTERS,
  );
  const [items, setItems] = useState<ReportedQuestionProjection[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, startLoadMoreTransition] = useTransition();
  // Bumped by the error banner's "Try Again" to re-run the first page.
  const [reloadKey, setReloadKey] = useState(0);

  const [summary, setSummary] = useState<QuestionReportsSummaryResult | null>(
    null,
  );
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);

  const hasActiveFilters =
    filters.reportType !== "" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "";

  const clearFilters = () => setFilters(EMPTY_REPORT_FILTERS);

  // ─── Summary (global — never affected by the filters) ─────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsSummaryLoading(true);

      const res = await getQuestionReportsSummaryAction();

      if (cancelled) return;

      if (res.success) {
        setSummary(res.data);
      } else {
        // Non-fatal: the list still works, the strip just stays hidden.
        toast.error(res.error.message);
      }

      setIsSummaryLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ─── First page: on mount, on filter change, and on retry ─────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);

      const res = await searchReportedQuestionsAction({
        reportType: filters.reportType || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });

      if (cancelled) return;

      if (res.success) {
        setItems(res.data.questions);
        setNextCursor(res.data.nextCursor);
        setHasMore(res.data.hasMore);
      } else {
        setItems([]);
        setNextCursor(null);
        setHasMore(false);
        setError(res.error.message);
        toast.error(res.error.message);
      }

      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [filters.reportType, filters.dateFrom, filters.dateTo, reloadKey]);

  const handleFilterChange = (key: keyof ReportFiltersState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSelectReportType = (value: ReportFiltersState["reportType"]) => {
    setFilters((prev) => ({ ...prev, reportType: value }));
  };

  const handleLoadMore = () => {
    if (!nextCursor || isLoadingMore) return;

    // Snapshot the controls so a filter change mid-flight can't stitch a
    // page from one window onto a cursor from another.
    const cursor = nextCursor;
    const reportType = filters.reportType || undefined;
    const dateFrom = filters.dateFrom || undefined;
    const dateTo = filters.dateTo || undefined;

    startLoadMoreTransition(async () => {
      const res = await searchReportedQuestionsAction({
        cursor,
        reportType,
        dateFrom,
        dateTo,
      });

      if (res.success) {
        setItems((prev) => [...prev, ...res.data.questions]);
        setNextCursor(res.data.nextCursor);
        setHasMore(res.data.hasMore);
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-16 overflow-x-hidden">
      {/* ─── Backlog summary + category chips ─── */}
      <ReportSummary
        summary={summary}
        isLoading={isSummaryLoading}
        activeReportType={filters.reportType}
        onSelectReportType={handleSelectReportType}
      />

      {/* ─── Report type + date window ─── */}
      <ReportFilters
        filters={filters}
        onChange={handleFilterChange}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
        resultLabel={isLoading ? "Searching…" : `${items.length} shown`}
        disabled={isLoading}
      />

      {/* ─── Error state ─── */}
      {error && !isLoading && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReloadKey((key) => key + 1)}
            className="text-xs"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* ─── Loading skeleton ─── */}
      {isLoading && (
        <div role="status" aria-label="Loading reported questions" className="space-y-6">
          <span className="sr-only">Loading reported questions...</span>
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <div className="rounded-xl border bg-card p-3 shadow-card sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-7 w-24 rounded-md" />
                </div>
                <div className="mt-2 flex gap-1.5">
                  <Skeleton className="h-5 w-28 rounded-md" />
                  <Skeleton className="h-5 w-24 rounded-md" />
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border bg-card p-5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-8 w-24 rounded-lg" />
                  <Skeleton className="h-5 w-28 rounded-md" />
                </div>
                <Skeleton className="h-10 w-3/4 rounded" />
                <div className="space-y-2.5">
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Empty state ─── */}
      {!isLoading && !error && items.length === 0 && (
        <EmptyState
          icon={Flag}
          title={
            hasActiveFilters
              ? "No reports match these filters"
              : "No reported questions yet"
          }
          description={
            hasActiveFilters
              ? "Try widening the date range or picking a different report type."
              : "Questions reported by students will appear here for review."
          }
        >
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="text-xs"
            >
              Clear Filters
            </Button>
          )}
        </EmptyState>
      )}

      {/* ─── Reported questions ─── */}
      {!isLoading && !error && items.length > 0 && (
        <div className="space-y-6">
          <p className="px-1 text-xs font-mono text-muted-foreground">
            Showing {items.length} reported question
            {items.length === 1 ? "" : "s"}
          </p>

          {items.map((item, idx) => (
            <ReportedQuestionItem
              key={item.questionId}
              item={item}
              questionNumber={idx + 1}
            />
          ))}

          {/* ─── Cursor pagination control ─── */}
          <div className="flex justify-center pt-2">
            {hasMore ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="gap-1.5 text-xs font-medium"
              >
                {isLoadingMore && <Loader2 className="size-3.5 animate-spin" />}
                {isLoadingMore ? "Loading..." : "Load more"}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                You&apos;ve reached the end of the report queue.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

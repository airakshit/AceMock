"use client";

import { useEffect, useState, useTransition } from "react";
import { Bookmark, HelpCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/patterns/empty-state";
import { getBookmarkedQuestionsAction } from "../../actions";
import type { BookmarkedQuestionProjection } from "../../dto/projections";
import { BookmarkFilters } from "./BookmarkFilters";
import { BookmarkedQuestionItem } from "./BookmarkedQuestionItem";

/**
 * BookmarksView — the signed-in user's bookmarked questions.
 *
 * Pagination is keyset/cursor based: `nextCursor` from each response is
 * passed back verbatim to fetch the following page (no limit/offset).
 * Both controls re-run the first page server-side so ordering and cursors
 * stay consistent.
 *
 * The subject select filters rows; the "Solution" switch is a load
 * toggle (`includeSolution`) — off by default, so the payload carries
 * questions + options only and each card fetches its solution on demand
 * ("View solution"). On, the page returns correct option + solution and
 * reveals them immediately.
 */
export function BookmarksView() {
  const [items, setItems] = useState<BookmarkedQuestionProjection[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, startLoadMoreTransition] = useTransition();

  // Controls (server-side)
  const [subjectSlug, setSubjectSlug] = useState("");
  const [includeSolution, setIncludeSolution] = useState(false);
  // Bumped by the error banner's "Try Again" to re-run the first page.
  const [reloadKey, setReloadKey] = useState(0);

  // First page: on mount, on filter change, and on retry.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);

      const res = await getBookmarkedQuestionsAction({
        subjectSlug: subjectSlug || undefined,
        includeSolution,
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
  }, [subjectSlug, includeSolution, reloadKey]);

  const handleLoadMore = () => {
    if (!nextCursor || isLoadingMore) return;

    const cursor = nextCursor;
    const subject = subjectSlug || undefined;
    const include = includeSolution;

    startLoadMoreTransition(async () => {
      const res = await getBookmarkedQuestionsAction({
        cursor,
        subjectSlug: subject,
        includeSolution: include,
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

  const handleRetry = () => setReloadKey((key) => key + 1);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      {/* ─── Controls (subject + solution) ─── */}
      <BookmarkFilters
        subjectSlug={subjectSlug}
        includeSolution={includeSolution}
        onSubjectChange={setSubjectSlug}
        onIncludeSolutionChange={setIncludeSolution}
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
            onClick={handleRetry}
            className="text-xs"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* ─── Loading skeleton ─── */}
      {isLoading && (
        <div role="status" aria-label="Loading bookmarks" className="space-y-6">
          <span className="sr-only">Loading bookmarked questions...</span>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="space-y-3 rounded-2xl border bg-card p-5 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-8 rounded-lg" />
                  <Skeleton className="h-5 w-20 rounded-md" />
                </div>
                <Skeleton className="h-4 w-24 rounded" />
              </div>
              <Skeleton className="h-10 w-3/4 rounded" />
              <div className="space-y-2.5">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Empty state ─── */}
      {!isLoading && !error && items.length === 0 && (
        <EmptyState
          icon={Bookmark}
          title={
            subjectSlug
              ? "No bookmarks match this subject"
              : "No bookmarked questions yet"
          }
          description={
            subjectSlug
              ? "Try a different subject to see more of your bookmarks."
              : "Open a question list and tap the bookmark icon on any question to save it here for later review."
          }
        >
          {subjectSlug && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSubjectSlug("")}
              className="text-xs"
            >
              Clear Filters
            </Button>
          )}
        </EmptyState>
      )}

      {/* ─── Bookmarked questions ─── */}
      {!isLoading && !error && items.length > 0 && (
        <div className="space-y-6">
          <p className="px-1 text-xs font-mono text-muted-foreground">
            Showing {items.length} bookmarked question
            {items.length === 1 ? "" : "s"}
          </p>

          {items.map((item, idx) => (
            <BookmarkedQuestionItem
              // Key includes the load toggle so switching it remounts the
              // cards and re-seeds each solution from the fresh payload.
              key={`${item.bookmarkId}-${includeSolution ? "with" : "no"}-solution`}
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
                You&apos;ve reached the end of your bookmarks.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

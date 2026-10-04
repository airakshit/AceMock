"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, History, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/patterns/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getMyAttemptHistoryAction } from "../../actions/get-my-attempt-history";
import type { AttemptHistoryItemProjection } from "../../dto/projections";
import type { AttemptGroup } from "./MockTestHistory";
import { MockTestHistory } from "./MockTestHistory";

function HistorySkeleton() {
  return (
    <div role="status" aria-label="Loading attempt history" className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-xl border border-border/80 bg-card p-4 shadow-card"
        >
          <Skeleton className="mb-4 h-5 w-56" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-10/12" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading attempt history...</span>
    </div>
  );
}

export function AttemptHistoryView() {
  const router = useRouter();

  const [items, setItems] = useState<AttemptHistoryItemProjection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [retryNonce, setRetryNonce] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Attempts grouped by mock test: newest attempt first within each test,
   * groups ordered by their most recent attempt.
   */
  const groups = useMemo<AttemptGroup[]>(() => {
    const byTestId = new Map<string, AttemptGroup>();

    for (const attempt of items) {
      const group = byTestId.get(attempt.mockTestId);
      if (group) {
        group.attempts.push(attempt);
      } else {
        byTestId.set(attempt.mockTestId, {
          mockTestId: attempt.mockTestId,
          mockTestName: attempt.mockTestName,
          attempts: [attempt],
        });
      }
    }

    const result = Array.from(byTestId.values());

    for (const group of result) {
      group.attempts.sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );
    }

    result.sort(
      (a, b) =>
        new Date(b.attempts[0].startedAt).getTime() -
        new Date(a.attempts[0].startedAt).getTime(),
    );

    return result;
  }, [items]);

  useEffect(() => {
    let isMounted = true;

    getMyAttemptHistoryAction()
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setItems(res.data);
        } else {
          toast.error(res.error.message || "Failed to load your attempt history.");
        }
        setIsLoading(false);
        setIsRefreshing(false);
      })
      .catch(() => {
        if (!isMounted) return;
        toast.error("An error occurred while fetching your attempt history.");
        setIsLoading(false);
        setIsRefreshing(false);
      });

    return () => {
      isMounted = false;
    };
  }, [retryNonce]);

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 self-start text-xs"
          onClick={() => router.push("/mocks")}
        >
          <ArrowLeft />
          All mock tests
        </Button>

        <div className="flex items-center gap-2">
          {!isLoading && (
            <span className="rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground tabular-nums">
              {items.length} {items.length === 1 ? "attempt" : "attempts"}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setIsRefreshing(true);
              setRetryNonce((n) => n + 1);
            }}
            disabled={isLoading || isRefreshing}
            aria-label="Refresh attempt history"
          >
            <RefreshCw
              className={cn("size-4", (isLoading || isRefreshing) && "animate-spin")}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <HistorySkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={History}
          title="No attempts yet"
          description="Your mock test attempts will appear here with scores and a full answer breakdown."
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => router.push("/mocks")}
          >
            Browse mock tests
            <ChevronRight />
          </Button>
        </EmptyState>
      ) : (
        <MockTestHistory
          groups={groups}
          onOpenDetails={(attemptId) => router.push(`/mocks/review/${attemptId}`)}
          onResume={(mockTestId) => router.push(`/mocks/${mockTestId}/attempt`)}
        />
      )}
    </div>
  );
}
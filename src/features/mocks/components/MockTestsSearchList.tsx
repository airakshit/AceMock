"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MockTestCard } from "@/components/patterns/mock-test-card";
import { EmptyState } from "@/components/patterns/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { layout } from "@/lib/design-system";
import type { ServerActionResult } from "@/features/shared/actions/types";
import type { SearchMockTestsFiltersPayload } from "../dto/payloads";
import type { MockTestSearchResult } from "../dto/results";
import { MockTestsFilterBar } from "./MockTestsFilterBar";
import { useMockTestsSearch } from "./use-mock-tests-search";
import {
  MockTestHistoryDialog,
  type MockTestHistoryTarget,
} from "./attempt-history/MockTestHistoryDialog";

interface MockTestsSearchListProps {
  /**
   * The view's pinned search action. The creator flags (`byAdmin` /
   * `userId`) are decided inside it, so this list can only ever show the
   * tests its action was written to expose.
   */
  search: (
    payload: SearchMockTestsFiltersPayload,
  ) => Promise<ServerActionResult<MockTestSearchResult>>;
  /** First page rendered by the server — seeds the list instead of a skeleton. */
  initial?: MockTestSearchResult | null;
  emptyTitle: string;
  emptyDescription: string;
  /** Rendered inside the empty state when no filter is active (e.g. a CTA). */
  emptyAction?: ReactNode;
}

function MockTestsSkeleton() {
  return (
    <div role="status" aria-label="Loading mock tests" className={layout.gridCards}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex h-56 animate-pulse flex-col justify-between rounded-xl border border-border/80 bg-card p-5"
        >
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading mock tests...</span>
    </div>
  );
}

/**
 * Filterable, keyset-paginated mock test grid.
 *
 * Shared by `/mocks/tests` and `/mocks/custom`; the only difference between
 * them is the search action they pass in, which is where the server pins the
 * creator flags. Filtering is name + scope + subject/section/chapter, results
 * page forward with an opaque cursor (never OFFSET), and the bar collapses to
 * one full-width column on phones.
 */
export function MockTestsSearchList({
  search,
  initial = null,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: MockTestsSearchListProps) {
  const router = useRouter();
  const [historyTest, setHistoryTest] = useState<MockTestHistoryTarget | null>(
    null,
  );

  const {
    items,
    hasNextPage,
    isLoadingMore,
    searchQuery,
    filters,
    hasActiveFilters,
    setSearchQuery,
    handleFilterChange,
    clearFilters,
    handleLoadMore,
    refresh,
  } = useMockTestsSearch({ search, initial });

  // The section-level refresh button (in MocksNav) re-runs the search in place.
  useEffect(() => {
    window.addEventListener("mocks:refresh", refresh);
    return () => window.removeEventListener("mocks:refresh", refresh);
  }, [refresh]);

  const handleStartTest = (testId: string) => {
    router.push(`/mocks/${testId}/attempt`);
  };

  return (
    <div className="space-y-4">
      <MockTestsFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
        resultLabel={items === null ? "Searching..." : `${items.length} shown`}
      />

      {items === null ? (
        <MockTestsSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={hasActiveFilters ? "No matching mock tests" : emptyTitle}
          description={
            hasActiveFilters
              ? "Try adjusting your search or clearing the filters."
              : emptyDescription
          }
        >
          {hasActiveFilters ? (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="gap-1.5 text-xs"
            >
              <X className="size-3.5" aria-hidden="true" />
              <span>Clear filters</span>
            </Button>
          ) : (
            emptyAction
          )}
        </EmptyState>
      ) : (
        <>
          <div className={layout.gridCards}>
            {items.map((test) => (
              <MockTestCard
                key={test.id}
                test={{
                  id: test.id,
                  title: test.name,
                  durationMinutes: Math.round(test.durationSeconds / 60),
                  totalQuestions: test.questionCount,
                  totalMarks: test.totalMarks,
                  negativePercentage: test.negativePercentagePerQuestion,
                }}
                onAction={handleStartTest}
                onShowHistory={(testId) =>
                  setHistoryTest({ id: testId, name: test.name })
                }
              />
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="gap-1.5 text-xs"
              >
                {isLoadingMore && (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                )}
                <span>{isLoadingMore ? "Loading..." : "Load more"}</span>
              </Button>
            </div>
          )}
        </>
      )}

      {/* Attempt history of a single mock test, shown as a pop-up */}
      <MockTestHistoryDialog
        mockTest={historyTest}
        onOpenChange={(open) => {
          if (!open) setHistoryTest(null);
        }}
      />
    </div>
  );
}

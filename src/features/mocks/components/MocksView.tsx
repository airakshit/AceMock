"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, History, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { MockTestCard } from "@/components/patterns/mock-test-card";
import { SearchInput } from "@/components/patterns/search-input";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { layout } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { MockTestListItemProjection } from "../dto/projections";
import { getMockTestsAction } from "../actions/get-mock-tests";
import {
  MockTestHistoryDialog,
  type MockTestHistoryTarget,
} from "./attempt-history/MockTestHistoryDialog";

interface MocksViewProps {
  initialTests?: MockTestListItemProjection[];
}

function MockTestsSkeleton() {
  return (
    <div role="status" aria-label="Loading mock tests" className={layout.gridCards}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex h-56 animate-pulse flex-col justify-between rounded-xl border border-border/80 bg-card p-5 shadow-card"
        >
          <div className="space-y-3">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Skeleton className="h-7 w-full rounded-lg" />
              <Skeleton className="h-7 w-full rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ))}
      <span className="sr-only">Loading mock tests...</span>
    </div>
  );
}

export function MocksView({ initialTests = [] }: MocksViewProps) {
  const router = useRouter();
  const [tests, setTests] = useState<MockTestListItemProjection[]>(initialTests);
  const [isLoading, setIsLoading] = useState(initialTests.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  /** Test whose attempt history pop-up is open, if any. */
  const [historyTest, setHistoryTest] = useState<MockTestHistoryTarget | null>(
    null,
  );

  const fetchTests = async (showRefreshSpinner = false) => {
    try {
      if (showRefreshSpinner) setIsRefreshing(true);
      const res = await getMockTestsAction();
      if (res.success) {
        setTests(res.data);
      } else {
        toast.error(res.error.message || "Failed to load mock tests.");
      }
    } catch (err) {
      toast.error("An error occurred while fetching mock tests.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (initialTests.length === 0) {
      fetchTests();
    }
  }, [initialTests.length]);

  const filteredTests = useMemo(() => {
    if (!searchQuery.trim()) return tests;
    const query = searchQuery.toLowerCase().trim();
    return tests.filter(
      (test) =>
        test.name.toLowerCase().includes(query) ||
        test.instructions?.toLowerCase().includes(query),
    );
  }, [tests, searchQuery]);

  const handleStartTest = (testId: string) => {
    router.push(`/mocks/${testId}/attempt`);
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search mock tests by title..."
          label="Search mock tests"
          className="sm:max-w-xs lg:max-w-sm"
        />

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/mocks/history")}
            className="h-8 gap-1.5 text-xs"
          >
            <History />
            My History
          </Button>

          <span className="rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground tabular-nums">
            {filteredTests.length}{" "}
            {filteredTests.length === 1 ? "test" : "tests"}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchTests(true)}
            disabled={isRefreshing}
            aria-label="Refresh mock tests"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw
              className={cn("size-3.5", isRefreshing && "animate-spin")}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Tests Grid */}
      {isLoading ? (
        <MockTestsSkeleton />
      ) : filteredTests.length === 0 ? (
        <EmptyState
          icon={searchQuery ? Search : ClipboardList}
          title={
            searchQuery ? "No matching mock tests" : "No mock tests available yet"
          }
          description={
            searchQuery
              ? "Try a different keyword or clear the search to see everything."
              : "Mock examinations will appear here once published by administrators."
          }
        >
          {searchQuery && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="gap-1 text-xs"
            >
              <X className="size-3.5" />
              Clear search
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className={layout.gridCards}>
          {filteredTests.map((test) => (
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

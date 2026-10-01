"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X, RefreshCw, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { MockTestCard } from "@/components/patterns/mock-test-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { layout } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { MockTestListItemProjection } from "../dto/projections";
import { getMockTestsAction } from "../actions/get-mock-tests";

interface MocksViewProps {
  initialTests?: MockTestListItemProjection[];
}

function MockTestsSkeleton() {
  return (
    <div className={layout.gridCards}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex h-56 flex-col justify-between rounded-xl border border-border/80 bg-card p-5 shadow-card"
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
          <Skeleton className="h-7 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function MocksView({ initialTests = [] }: MocksViewProps) {
  const [tests, setTests] = useState<MockTestListItemProjection[]>(initialTests);
  const [isLoading, setIsLoading] = useState(initialTests.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
    toast.info("Exam taking simulation session is coming up in the next phase!");
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-card md:flex-row md:items-center md:justify-between">
        {/* Search Input */}
        <div className="group relative flex-1 md:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-brand" />
          <input
            type="text"
            placeholder="Search mock tests by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-background pr-8 pl-8.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-brand/40 focus:outline-none focus:ring-3 focus:ring-brand/15"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Right Toolbar Controls */}
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground tabular-nums">
            {filteredTests.length}{" "}
            {filteredTests.length === 1 ? "test" : "tests"}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchTests(true)}
            disabled={isRefreshing}
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 p-12 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-brand-muted text-brand">
            {searchQuery ? (
              <Search className="size-5" />
            ) : (
              <ClipboardList className="size-5" />
            )}
          </div>
          <p className="text-sm font-semibold text-foreground">
            {searchQuery ? "No matching mock tests" : "No mock tests available yet"}
          </p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {searchQuery
              ? "Try a different keyword or clear the search to see everything."
              : "Mock examinations will appear here once published by administrators."}
          </p>
          {searchQuery && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="mt-4 text-xs"
            >
              Clear search filter
            </Button>
          )}
        </div>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

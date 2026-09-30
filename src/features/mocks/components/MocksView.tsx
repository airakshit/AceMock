"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Search, X, RefreshCw, Loader2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { MockTestCard } from "@/components/patterns/mock-test-card";
import { Button } from "@/components/ui/button";
import { layout } from "@/lib/design-system";
import { MockTestListItemProjection } from "../dto/projections";
import { getMockTestsAction } from "../actions/get-mock-tests";

interface MocksViewProps {
  initialTests?: MockTestListItemProjection[];
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
    <div className="space-y-5">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-2xs md:flex-row md:items-center md:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search mock tests by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8.5 w-full rounded-md border border-border bg-background pl-8.5 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* Right Toolbar Controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {filteredTests.length} {filteredTests.length === 1 ? "test" : "tests"} available
          </span>

          <Button
            variant="ghost"
            size="xs"
            onClick={() => fetchTests(true)}
            disabled={isRefreshing}
            className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Tests Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-xs font-medium">Fetching mock tests from server...</p>
        </div>
      ) : filteredTests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-12 text-center space-y-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
            <ClipboardList className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-1 max-w-sm">
            <p className="text-sm font-semibold text-foreground">
              {searchQuery ? "No matching mock tests" : "No mock tests available yet"}
            </p>
            <p className="text-xs text-muted-foreground">
              {searchQuery
                ? "Try searching for a different keyword."
                : "Mock examinations will appear here once published by administrators."}
            </p>
          </div>
          {searchQuery && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="text-xs mt-2"
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

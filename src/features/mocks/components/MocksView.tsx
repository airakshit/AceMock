"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { MockTestCard } from "@/components/patterns/mock-test-card";
import { EmptyState } from "@/components/patterns/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { layout } from "@/lib/design-system";
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
  /** Bumped by the section refresh (MocksNav) to re-run the fetch. */
  const [refreshNonce, setRefreshNonce] = useState(0);
  /** Test whose attempt history pop-up is open, if any. */
  const [historyTest, setHistoryTest] = useState<MockTestHistoryTarget | null>(
    null,
  );

  const fetchTests = async () => {
    try {
      const res = await getMockTestsAction();
      if (res.success) {
        setTests(res.data);
      } else {
        toast.error(res.error.message || "Failed to load mock tests.");
      }
    } catch {
      toast.error("An error occurred while fetching mock tests.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (refreshNonce > 0 || initialTests.length === 0) {
      fetchTests();
    }
  }, [refreshNonce, initialTests.length]);

  // The section-level refresh button (in MocksNav) re-runs the fetch in place.
  useEffect(() => {
    const handleSectionRefresh = () => {
      setIsLoading(true);
      setRefreshNonce((n) => n + 1);
    };
    window.addEventListener("mocks:refresh", handleSectionRefresh);
    return () => window.removeEventListener("mocks:refresh", handleSectionRefresh);
  }, []);

  const handleStartTest = (testId: string) => {
    router.push(`/mocks/${testId}/attempt`);
  };

  return (
    <div className="space-y-6">
      {/* Tests Grid */}
      {isLoading ? (
        <MockTestsSkeleton />
      ) : tests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No mock tests available yet"
          description="Mock examinations will appear here once published by administrators."
        />
      ) : (
        <div className={layout.gridCards}>
          {tests.map((test) => (
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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyAttemptHistoryAction } from "../../actions/get-my-attempt-history";
import type { AttemptHistoryItemProjection } from "../../dto/projections";
import { MockTestAttemptsTable } from "./MockTestAttemptsTable";

/** The mock test whose attempts are shown; `null` keeps the pop-up closed. */
export interface MockTestHistoryTarget {
  id: string;
  name: string;
}

interface MockTestHistoryDialogProps {
  mockTest: MockTestHistoryTarget | null;
  /** Controlled open state: called when the user dismisses the pop-up. */
  onOpenChange: (open: boolean) => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; attempts: AttemptHistoryItemProjection[] };

function DialogHistorySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading attempt history"
      className="space-y-3"
    >
      <div className="h-20 animate-pulse rounded-xl border border-border/80 bg-card p-4 shadow-card">
        <Skeleton className="mb-3 h-5 w-56" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="h-40 animate-pulse rounded-xl border border-border/80 bg-card p-4 shadow-card">
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-4 w-9/12" />
        </div>
      </div>
      <span className="sr-only">Loading attempt history...</span>
    </div>
  );
}

/**
 * Pop-up with the attempt history of a single mock test — the same table the
 * /mocks/history page renders, scoped to one test. It refetches on every open
 * but keeps the last result cached, so reopening shows the list instantly.
 */
export function MockTestHistoryDialog({
  mockTest,
  onOpenChange,
}: MockTestHistoryDialogProps) {
  const router = useRouter();
  const mockTestId = mockTest?.id ?? null;

  /** Last result, tagged with the test it belongs to. */
  const [cache, setCache] = useState<{
    id: string;
    state: LoadState;
  } | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const state: LoadState =
    cache && cache.id === mockTestId
      ? cache.state
      : { status: "loading" };

  useEffect(() => {
    if (!mockTestId) return;
    let isMounted = true;

    getMyAttemptHistoryAction(mockTestId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setCache({
            id: mockTestId,
            state: { status: "ready", attempts: res.data },
          });
        } else {
          toast.error(
            res.error.message || "Failed to load your attempt history.",
          );
          setCache({
            id: mockTestId,
            state: { status: "error", message: res.error.message },
          });
        }
      })
      .catch(() => {
        if (!isMounted) return;
        const message = "An error occurred while fetching your attempt history.";
        toast.error(message);
        setCache({ id: mockTestId, state: { status: "error", message } });
      });

    return () => {
      isMounted = false;
    };
  }, [mockTestId, retryNonce]);

  const retry = () => {
    setCache(null);
    setRetryNonce((n) => n + 1);
  };

  const handleOpenDetails = (attemptId: string) => {
    onOpenChange(false);
    router.push(`/mocks/review/${attemptId}`);
  };

  const handleResume = (testId: string) => {
    onOpenChange(false);
    router.push(`/mocks/${testId}/attempt`);
  };

  return (
    <Dialog open={mockTest !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-border/80 px-4 py-4 pr-12 sm:px-5">
          <DialogTitle>Attempt history</DialogTitle>
          <DialogDescription className="truncate">
            {mockTest?.name ?? "Your attempts at this mock test"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5">
          {state.status === "loading" ? (
            <DialogHistorySkeleton />
          ) : state.status === "error" ? (
            <EmptyState
              icon={History}
              title="Couldn't load attempt history"
              description={state.message}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={retry}
              >
                <RefreshCw className="size-3.5" />
                Try again
              </Button>
            </EmptyState>
          ) : state.attempts.length === 0 ? (
            <EmptyState
              icon={History}
              title="No attempts yet"
              description="You haven't taken this mock test yet. Start it and your attempts will appear here."
            />
          ) : mockTest ? (
            <MockTestAttemptsTable
              group={{
                mockTestId: mockTest.id,
                mockTestName: mockTest.name,
                attempts: state.attempts,
              }}
              onOpenDetails={handleOpenDetails}
              onResume={handleResume}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

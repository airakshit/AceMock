"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ClipboardList,
  PlusCircle,
  Clock,
  Percent,
  Trash2,
  Eye,
  RefreshCw,
  FileQuestion,
  Calendar,
  User,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MetricCard } from "@/components/patterns/metric-card";
import { SearchInput } from "@/components/patterns/search-input";
import { EmptyState } from "@/components/patterns/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MockTestListItemProjection } from "../../dto/projections";
import { getAdminMockTestsAction } from "../../actions/get-admin-mock-tests";
import { deleteMockTestAction } from "../../actions/delete-mock-test";
import { CreateMockTestModal } from "./CreateMockTestModal";
import { MockTestQuestionsModal } from "./MockTestQuestionsModal";

function AdminTestsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading mock tests"
      className="divide-y divide-border/60"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5 rounded" />
            <Skeleton className="h-3 w-3/5 rounded" />
          </div>
          <div className="flex shrink-0 gap-2">
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading mock examinations...</span>
    </div>
  );
}

export function MockTestsAdminView() {
  const [tests, setTests] = useState<MockTestListItemProjection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [inspectTestId, setInspectTestId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] =
    useState<MockTestListItemProjection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch tests
  const fetchMockTests = async () => {
    try {
      setIsLoading(true);
      const res = await getAdminMockTestsAction();
      if (res.success) {
        setTests(res.data);
      } else {
        toast.error(res.error.message || "Failed to load mock tests.");
      }
    } catch (err) {
      toast.error("An error occurred while fetching mock tests.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMockTests();
  }, []);

  // Filtered tests
  const filteredTests = useMemo(() => {
    if (!searchQuery.trim()) return tests;
    const query = searchQuery.toLowerCase().trim();
    return tests.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.creatorName?.toLowerCase().includes(query) ||
        t.creatorEmail?.toLowerCase().includes(query),
    );
  }, [tests, searchQuery]);

  // Metric aggregates
  const metrics = useMemo(() => {
    const totalTests = tests.length;
    const totalQuestions = tests.reduce((acc, t) => acc + t.questionCount, 0);
    const avgDuration =
      totalTests > 0
        ? Math.round(
            tests.reduce((acc, t) => acc + t.durationSeconds / 60, 0) /
              totalTests,
          )
        : 0;
    const avgNegative =
      totalTests > 0
        ? Math.round(
            tests.reduce((acc, t) => acc + t.negativePercentagePerQuestion, 0) /
              totalTests,
          )
        : 0;

    return { totalTests, totalQuestions, avgDuration, avgNegative };
  }, [tests]);

  // Handle delete
  const handleDeleteConfirm = async () => {
    if (!deleteCandidate) return;

    try {
      setIsDeleting(true);
      const res = await deleteMockTestAction(deleteCandidate.id);
      if (res.success) {
        toast.success(`Mock test "${deleteCandidate.name}" deleted.`);
        setDeleteCandidate(null);
        fetchMockTests();
      } else {
        toast.error(res.error.message || "Failed to delete mock test.");
      }
    } catch (err) {
      toast.error("An unexpected error occurred while deleting.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Metrics Highlights */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 sm:gap-4">
        <MetricCard
          label="Active Mock Tests"
          value={metrics.totalTests}
          hint="Exams assembled and available"
          accent="brand"
          icon={<ClipboardList className="size-4" />}
        />
        <MetricCard
          label="Assigned Questions"
          value={metrics.totalQuestions}
          hint="Bound across every test"
          accent="info"
          icon={<FileQuestion className="size-4" />}
        />
        <MetricCard
          label="Avg. Duration"
          value={metrics.avgDuration}
          hint="Minutes per test"
          icon={<Clock className="size-4" />}
        />
        <MetricCard
          label="Avg. Penalty"
          value={`${metrics.avgNegative}%`}
          hint="Deduction per wrong answer"
          accent="warning"
          icon={<Percent className="size-4" />}
        />
      </div>

      {/* Search & Actions Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by title or creator..."
          label="Search mock tests"
          className="sm:max-w-xs lg:max-w-sm"
        />

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <span className="rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground tabular-nums">
            {filteredTests.length} of {tests.length} tests
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchMockTests}
            disabled={isLoading}
            aria-label="Refresh mock tests"
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw
              className={cn("size-3.5", isLoading && "animate-spin")}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            onClick={() => setIsCreateModalOpen(true)}
            size="sm"
            aria-label="Create mock test from documents"
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <PlusCircle className="size-3.5" />
            <span>Create</span>
            <span className="hidden sm:inline"> from Documents</span>
          </Button>
        </div>
      </div>

      {/* Tests List */}
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-card">
        {isLoading ? (
          <AdminTestsSkeleton />
        ) : filteredTests.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={
              searchQuery ? "No matching mock tests" : "No mock tests created yet"
            }
            description={
              searchQuery
                ? "Try adjusting your search terms or clearing the filter."
                : "Assemble your first mock examination by selecting questions from ingested documents."
            }
          >
            {searchQuery ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="text-xs"
              >
                Clear search
              </Button>
            ) : (
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                size="sm"
                className="text-xs font-medium gap-1.5"
              >
                <PlusCircle className="size-3.5" />
                <span>Create Mock Test</span>
              </Button>
            )}
          </EmptyState>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredTests.map((test) => {
              const durationMins = Math.round(test.durationSeconds / 60);

              return (
                <div
                  key={test.id}
                  className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1.5 sm:pr-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-foreground">
                        {test.name}
                      </h3>
                      <Badge
                        variant="secondary"
                        className="h-5 border-primary/20 bg-primary/10 text-[10px] font-semibold text-primary"
                      >
                        {test.questionCount}{" "}
                        {test.questionCount === 1 ? "Question" : "Questions"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="h-5 border-border text-[10px] font-medium"
                      >
                        {test.totalMarks} Marks
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" aria-hidden="true" />
                        {durationMins} mins
                      </span>
                      <span aria-hidden="true">•</span>
                      <span className="flex items-center gap-1">
                        <Percent className="size-3" aria-hidden="true" />
                        -{test.negativePercentagePerQuestion}% penalty
                      </span>
                      <span aria-hidden="true">•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" aria-hidden="true" />
                        {new Date(test.createdAt).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </span>
                      {test.creatorName && (
                        <>
                          <span aria-hidden="true">•</span>
                          <span className="flex items-center gap-1">
                            <User className="size-3" aria-hidden="true" />
                            {test.creatorName}
                          </span>
                        </>
                      )}
                    </div>

                    {test.instructions && (
                      <p className="line-clamp-1 text-xs text-muted-foreground/80 italic">
                        {test.instructions}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2 border-t border-border/40 pt-3 sm:border-t-0 sm:pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInspectTestId(test.id)}
                      className="h-8 flex-1 gap-1.5 text-xs sm:flex-none"
                    >
                      <Eye className="size-3.5 text-muted-foreground" />
                      <span>Inspect Questions</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteCandidate(test)}
                      aria-label={`Delete ${test.name}`}
                      title="Delete mock test"
                      className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Creation Modal */}
      <CreateMockTestModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onTestCreated={fetchMockTests}
      />

      {/* Question Inspection Modal */}
      <MockTestQuestionsModal
        mockTestId={inspectTestId}
        onClose={() => setInspectTestId(null)}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteCandidate)}
        onOpenChange={(o) => !o && setDeleteCandidate(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-foreground">
              Delete Mock Test
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete{" "}
              <strong className="text-foreground">{deleteCandidate?.name}</strong>
              ? This action will permanently remove the test and unbind its
              question sequence.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteCandidate(null)}
              disabled={isDeleting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="text-xs gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Confirm Delete</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

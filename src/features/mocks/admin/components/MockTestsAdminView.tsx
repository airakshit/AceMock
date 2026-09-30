"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ClipboardList,
  PlusCircle,
  Search,
  Clock,
  Award,
  Percent,
  Trash2,
  Eye,
  RefreshCw,
  FileQuestion,
  Sparkles,
  Layers,
  Calendar,
  User,
  AlertCircle,
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
import { MockTestListItemProjection } from "../../dto/projections";
import { getAdminMockTestsAction } from "../../actions/get-admin-mock-tests";
import { deleteMockTestAction } from "../../actions/delete-mock-test";
import { CreateMockTestModal } from "./CreateMockTestModal";
import { MockTestQuestionsModal } from "./MockTestQuestionsModal";

export function MockTestsAdminView() {
  const [tests, setTests] = useState<MockTestListItemProjection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [inspectTestId, setInspectTestId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<MockTestListItemProjection | null>(null);
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
            tests.reduce((acc, t) => acc + t.durationSeconds / 60, 0) / totalTests,
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
      {/* Top Banner & Primary Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ClipboardList className="size-4" />
            </span>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Mock Tests Administration
            </h2>
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/5 text-primary text-[10px] font-semibold tracking-wide uppercase"
            >
              Admin Control
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Assemble, configure, and manage mock examinations generated from document question banks.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMockTests}
            disabled={isLoading}
            className="text-xs gap-1.5 h-8.5"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            onClick={() => setIsCreateModalOpen(true)}
            size="sm"
            className="text-xs font-medium gap-1.5 h-8.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
          >
            <PlusCircle className="size-3.5" />
            <span>Create from Documents</span>
          </Button>
        </div>
      </div>

      {/* Metrics Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <ClipboardList className="size-3.5 text-primary" />
            Active Mock Tests
          </span>
          <p className="text-xl font-bold text-foreground tracking-tight">
            {metrics.totalTests}
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <FileQuestion className="size-3.5 text-primary" />
            Assigned Questions
          </span>
          <p className="text-xl font-bold text-foreground tracking-tight">
            {metrics.totalQuestions}
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Clock className="size-3.5 text-primary" />
            Avg. Test Duration
          </span>
          <p className="text-xl font-bold text-foreground tracking-tight">
            {metrics.avgDuration} <span className="text-xs font-normal text-muted-foreground">mins</span>
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Percent className="size-3.5 text-primary" />
            Avg. Negative Penalty
          </span>
          <p className="text-xl font-bold text-foreground tracking-tight">
            {metrics.avgNegative}%
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card p-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search mock tests by title or creator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8.5 w-full rounded-md border border-border bg-background pl-8.5 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{filteredTests.length}</strong> of{" "}
            {tests.length} tests
          </span>
        </div>
      </div>

      {/* Tests Table / List */}
      <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-xs font-medium">Loading mock examinations...</p>
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ClipboardList className="size-6" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-sm font-semibold text-foreground">
                {searchQuery ? "No matching mock tests" : "No mock tests created yet"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {searchQuery
                  ? "Try adjusting your search terms or clearing the filter."
                  : "Assemble your first full mock examination by selecting questions from ingested documents."}
              </p>
            </div>
            {!searchQuery && (
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                size="sm"
                className="text-xs font-medium gap-1.5 mt-2"
              >
                <PlusCircle className="size-3.5" />
                <span>Create Mock Test</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredTests.map((test) => {
              const durationMins = Math.round(test.durationSeconds / 60);

              return (
                <div
                  key={test.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-muted/30"
                >
                  <div className="space-y-1.5 min-w-0 flex-1 pr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs font-semibold text-foreground truncate">
                        {test.name}
                      </h3>
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-5 font-semibold text-primary bg-primary/10 border-primary/20"
                      >
                        {test.questionCount} {test.questionCount === 1 ? "Question" : "Questions"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] h-5 font-medium border-border">
                        {test.totalMarks} Marks
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3 text-muted-foreground" />
                        {durationMins} mins
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Percent className="size-3 text-muted-foreground" />
                        -{test.negativePercentagePerQuestion}% Penalty
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3 text-muted-foreground" />
                        {new Date(test.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {test.creatorName && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <User className="size-3 text-muted-foreground" />
                            {test.creatorName}
                          </span>
                        </>
                      )}
                    </div>

                    {test.instructions && (
                      <p className="text-[11px] text-muted-foreground/80 line-clamp-1 italic">
                        {test.instructions}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInspectTestId(test.id)}
                      className="text-xs gap-1.5 h-8 text-foreground hover:bg-muted"
                    >
                      <Eye className="size-3.5 text-muted-foreground" />
                      <span>Inspect Questions</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteCandidate(test)}
                      className="text-xs h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
              <strong className="text-foreground">{deleteCandidate?.name}</strong>? This action
              will permanently remove the test and unbind its question sequence.
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

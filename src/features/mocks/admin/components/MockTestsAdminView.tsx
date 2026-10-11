"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ListFilter,
  Repeat2,
  X,
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
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { MetricCard } from "@/components/patterns/metric-card";
import { SearchInput } from "@/components/patterns/search-input";
import { EmptyState } from "@/components/patterns/empty-state";
import { HierarchyFilterChips } from "@/components/patterns/hierarchy-filter-chips";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { CurriculumOptionsProjection } from "@/features/questions/dto/projections";
import { getCurriculumOptionsAction } from "@/features/questions/actions";
import {
  MockTestListItemProjection,
  MockTestScope,
} from "../../dto/projections";
import type { SearchMockTestsPayload } from "../../dto/payloads";
import { getAdminMockTestsAction } from "../../actions/get-admin-mock-tests";
import { searchMockTestsAction } from "../../actions/search-mock-tests";
import { deleteMockTestAction } from "../../actions/delete-mock-test";
import { CreateMockTestModal } from "./CreateMockTestModal";
import { MockTestQuestionsModal } from "./MockTestQuestionsModal";

/** Rows fetched per search page (one extra row is requested server-side). */
const PAGE_SIZE = 10;

/** Server search is debounced so typing does not fire a request per key. */
const SEARCH_DEBOUNCE_MS = 350;

const EMPTY_CURRICULUM: CurriculumOptionsProjection = {
  subjects: [],
  sections: [],
  chapters: [],
};

const EMPTY_FILTERS: Filters = {
  scope: "",
  subjectId: "",
  sectionId: "",
  chapterId: "",
  byAdmin: "",
};

/** Header shown above each group when the list is hierarchically ordered. */
const SCOPE_GROUP_LABELS: Record<MockTestScope, string> = {
  ioe_model: "IOE Model Mock Tests",
  subject: "Subject Mock Tests",
  section: "Section Mock Tests",
  chapter: "Chapter Mock Tests",
  miscellaneous: "Miscellaneous Mock Tests",
};

interface Filters {
  scope: string;
  subjectId: string;
  sectionId: string;
  chapterId: string;
  /** "" = any, "admin" = admin-created, "user" = user-created */
  byAdmin: string;
}

interface TestGroup {
  label: string | null;
  items: MockTestListItemProjection[];
}

/** Narrows a raw <select> value to a scope, or undefined for "all scopes". */
const parseScope = (value: string): MockTestScope | undefined => {
  if (!value) return undefined;
  return value in SCOPE_GROUP_LABELS ? (value as MockTestScope) : undefined;
};

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
  // Full list of every test — only feeds the metric cards. The list itself
  // is served by the cursor-paginated search below.
  const [tests, setTests] = useState<MockTestListItemProjection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cursor-paginated search results (null until the first page arrives)
  const [items, setItems] = useState<MockTestListItemProjection[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });
  const [curriculum, setCurriculum] =
    useState<CurriculumOptionsProjection | null>(null);
  const requestIdRef = useRef(0);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [inspectTestId, setInspectTestId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] =
    useState<MockTestListItemProjection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch the aggregate source for the metric cards. Only touches state
  // from promise callbacks, so this is safe to call from an effect.
  const fetchMockTests = () => {
    getAdminMockTestsAction()
      .then((res) => {
        if (res.success) {
          setTests(res.data);
        } else {
          toast.error(res.error.message || "Failed to load mock tests.");
        }
      })
      .catch(() => {
        toast.error("An error occurred while fetching mock tests.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchMockTests();
  }, []);

  // Curriculum behind the subject / section / chapter filters
  useEffect(() => {
    let isMounted = true;

    getCurriculumOptionsAction()
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setCurriculum(res.data.curriculum);
        } else {
          setCurriculum(EMPTY_CURRICULUM);
          toast.error(res.error.message || "Failed to load curriculum.");
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setCurriculum(EMPTY_CURRICULUM);
        toast.error("An error occurred while loading the curriculum.");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Debounce the name search so typing does not fire a request per key.
  useEffect(() => {
    if (searchQuery === debouncedSearch) return;

    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setItems(null);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearch]);

  /**
   * Loads the first page of a search. Stale responses (superseded by a
   * newer search) are dropped, and state is only touched from callbacks.
   */
  const runFirstPageSearch = useCallback(
    (query: SearchMockTestsPayload) => {
      const requestId = ++requestIdRef.current;

      searchMockTestsAction(query)
        .then((res) => {
          if (requestId !== requestIdRef.current) return;

          if (res.success) {
            setItems(res.data.items);
            setNextCursor(res.data.nextCursor);
            setHasNextPage(res.data.hasNextPage);
          } else {
            setItems((prev) => prev ?? []);
            toast.error(res.error.message || "Failed to search mock tests.");
          }
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setItems((prev) => prev ?? []);
          toast.error("An error occurred while searching mock tests.");
        });
    },
    [],
  );

  // The exact query for the current filters — `cursor` continues a result.
  const buildQuery = useCallback(
    (cursor: string | null): SearchMockTestsPayload => ({
      scope: parseScope(filters.scope),
      subjectId: filters.subjectId || undefined,
      sectionId: filters.sectionId || undefined,
      chapterId: filters.chapterId || undefined,
      byAdmin: filters.byAdmin ? filters.byAdmin === "admin" : undefined,
      search: debouncedSearch || undefined,
      cursor: cursor ?? undefined,
      pageSize: PAGE_SIZE,
    }),
    [filters, debouncedSearch],
  );

  // Reload the first page whenever a filter or the debounced search changes.
  useEffect(() => {
    runFirstPageSearch(buildQuery(null));
  }, [buildQuery, runFirstPageSearch]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Picking a parent invalidates every child filter below it.
      if (key === "subjectId") {
        next.sectionId = "";
        next.chapterId = "";
      }
      if (key === "sectionId") {
        next.chapterId = "";
      }
      return next;
    });
    setItems(null);
  };

  const clearFilters = () => {
    const willChangeQuery =
      Boolean(
        filters.scope ||
          filters.subjectId ||
          filters.sectionId ||
          filters.chapterId ||
          filters.byAdmin,
      ) || debouncedSearch !== "";

    setFilters({ ...EMPTY_FILTERS });
    setSearchQuery("");
    setDebouncedSearch("");
    // Only blank the list when the query really changes — otherwise the
    // effect below would not fire and the skeleton would never resolve.
    if (willChangeQuery) setItems(null);
  };

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const res = await searchMockTestsAction(buildQuery(nextCursor));
      if (res.success) {
        setItems((prev) => [...(prev ?? []), ...res.data.items]);
        setNextCursor(res.data.nextCursor);
        setHasNextPage(res.data.hasNextPage);
      } else {
        toast.error(res.error.message || "Failed to load more tests.");
      }
    } catch {
      toast.error("An error occurred while loading more tests.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const refreshAll = () => {
    fetchMockTests();
    runFirstPageSearch(buildQuery(null));
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setItems(null);
    fetchMockTests();
    runFirstPageSearch(buildQuery(null));
  };

  const hasActiveFilters = Boolean(
    filters.scope ||
      filters.subjectId ||
      filters.sectionId ||
      filters.chapterId ||
      filters.byAdmin ||
      searchQuery,
  );

  // A hierarchy filter makes the server order parents before children, so
  // the flat result can be rendered as labelled groups in one pass.
  const hierarchyFilterActive = Boolean(
    filters.subjectId || filters.sectionId || filters.chapterId,
  );

  const testGroups = useMemo<TestGroup[]>(() => {
    const list = items ?? [];

    if (!hierarchyFilterActive) return [{ label: null, items: list }];

    const groups: TestGroup[] = [];
    for (const test of list) {
      const label = SCOPE_GROUP_LABELS[test.scope];
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.items.push(test);
      } else {
        groups.push({ label, items: [test] });
      }
    }
    return groups;
  }, [items, hierarchyFilterActive]);

  const availableSections = useMemo(
    () =>
      filters.subjectId
        ? (curriculum?.sections ?? []).filter(
            (s) => s.subjectId === filters.subjectId,
          )
        : [],
    [curriculum, filters.subjectId],
  );

  const availableChapters = useMemo(
    () =>
      filters.sectionId
        ? (curriculum?.chapters ?? []).filter(
            (c) => c.sectionId === filters.sectionId,
          )
        : [],
    [curriculum, filters.sectionId],
  );

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
        refreshAll();
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
          placeholder="Search by test name..."
          label="Search mock tests"
          className="sm:max-w-xs lg:max-w-sm"
        />

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <span className="rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground tabular-nums">
            {items === null ? "Searching..." : `${items.length} shown`}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
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

      {/* Search Filters — subjects first; sections and chapters reveal one level at a time */}
      <div className="rounded-xl border border-border/80 bg-card p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <ListFilter className="size-3.5" aria-hidden="true" />
            <span>Filters</span>
          </span>

          <NativeSelect
            size="sm"
            value={filters.scope}
            onChange={(e) => handleFilterChange("scope", e.target.value)}
            aria-label="Scope"
            className="w-40"
          >
            <NativeSelectOption value="">All scopes</NativeSelectOption>
            <NativeSelectOption value="ioe_model">IOE Model</NativeSelectOption>
            <NativeSelectOption value="subject">Subject</NativeSelectOption>
            <NativeSelectOption value="section">Section</NativeSelectOption>
            <NativeSelectOption value="chapter">Chapter</NativeSelectOption>
            <NativeSelectOption value="miscellaneous">
              Miscellaneous
            </NativeSelectOption>
          </NativeSelect>

          <NativeSelect
            size="sm"
            value={filters.byAdmin}
            onChange={(e) => handleFilterChange("byAdmin", e.target.value)}
            aria-label="Created by"
            className="w-36"
          >
            <NativeSelectOption value="">Anyone</NativeSelectOption>
            <NativeSelectOption value="admin">Admin</NativeSelectOption>
            <NativeSelectOption value="user">User</NativeSelectOption>
          </NativeSelect>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 gap-1 text-xs text-muted-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
              <span>Clear filters</span>
            </Button>
          )}
        </div>

        <div className="mt-1 space-y-1">
          <HierarchyFilterChips
            label="Subject"
            options={curriculum?.subjects ?? []}
            value={filters.subjectId}
            onChange={(value) => handleFilterChange("subjectId", value)}
            allLabel="All subjects"
            loading={curriculum === null}
            emptyLabel={
              curriculum === null ? "Loading subjects…" : "No subjects found"
            }
          />

          {filters.subjectId && (
            <HierarchyFilterChips
              label="Section"
              options={availableSections}
              value={filters.sectionId}
              onChange={(value) => handleFilterChange("sectionId", value)}
              allLabel="All sections"
              emptyLabel="No sections in this subject"
            />
          )}

          {filters.sectionId && (
            <HierarchyFilterChips
              label="Chapter"
              options={availableChapters}
              value={filters.chapterId}
              onChange={(value) => handleFilterChange("chapterId", value)}
              allLabel="All chapters"
              emptyLabel="No chapters in this section"
            />
          )}
        </div>
      </div>

      {/* Tests List */}
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-card">
        {items === null ? (
          <AdminTestsSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={
              hasActiveFilters
                ? "No matching mock tests"
                : "No mock tests created yet"
            }
            description={
              hasActiveFilters
                ? "Try adjusting your search or clearing the filters."
                : "Assemble your first mock examination by selecting questions from ingested documents."
            }
          >
            {hasActiveFilters ? (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="text-xs gap-1.5"
              >
                <X className="size-3.5" aria-hidden="true" />
                <span>Clear filters</span>
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
          <div>
            {testGroups.map((group) => (
              <div key={group.label ?? "all-tests"}>
                {group.label && (
                  <div className="border-b border-border/60 bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </div>
                )}

                <div className="divide-y divide-border/60">
                  {group.items.map((test) => {
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
                              {test.questionCount === 1
                                ? "Question"
                                : "Questions"}
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
                              {test.allowUntimed
                                ? "Untimed"
                                : `${durationMins} mins`}
                            </span>
                            <span aria-hidden="true">•</span>
                            <span className="flex items-center gap-1">
                              <Percent className="size-3" aria-hidden="true" />
                              -{test.negativePercentagePerQuestion}% penalty
                            </span>
                            <span aria-hidden="true">•</span>
                            <span className="flex items-center gap-1">
                              <Repeat2 className="size-3" aria-hidden="true" />
                              {test.maxAttempts === 0
                                ? "Unlimited attempts"
                                : `${test.maxAttempts} ${
                                    test.maxAttempts === 1
                                      ? "attempt"
                                      : "attempts"
                                  }`}
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
              </div>
            ))}

            {/* Cursor pagination */}
            <div className="border-t border-border/60 p-3">
              {hasNextPage ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="h-8 w-full gap-1.5 text-xs"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Loading more...</span>
                    </>
                  ) : (
                    <span>Load more tests</span>
                  )}
                </Button>
              ) : (
                <p className="text-center text-[11px] text-muted-foreground">
                  All {items.length} matching tests loaded.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Creation Modal */}
      <CreateMockTestModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onTestCreated={refreshAll}
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { ServerActionResult } from "@/features/shared/actions/types";
import { applyMockTestFilterChange } from "../filter-state";
import type { SearchMockTestsFiltersPayload } from "../dto/payloads";
import type {
  MockTestListItemProjection,
  MockTestScope,
} from "../dto/projections";
import type { MockTestSearchResult } from "../dto/results";

/** Server search is debounced so typing does not fire a request per key. */
export const SEARCH_DEBOUNCE_MS = 350;

/**
 * Raw values of the two filter levels. Empty string means "any"; `scope`
 * holds a `MockTestScope` or "" for "All" (every type).
 */
export interface MockTestsFilterState {
  scope: string;
  subjectId: string;
  sectionId: string;
  chapterId: string;
}

export const EMPTY_MOCK_TESTS_FILTERS: MockTestsFilterState = {
  scope: "",
  subjectId: "",
  sectionId: "",
  chapterId: "",
};

/**
 * Every `MockTestScope` value — the only strings a scope filter may hold.
 *
 * Mirrors `MOCK_TEST_SCOPES` in `../utils`; that module is kept out of the
 * client bundle because its cursor helpers are Buffer-based.
 */
const MOCK_TEST_SCOPE_VALUES: readonly MockTestScope[] = [
  "ioe_model",
  "subject",
  "section",
  "chapter",
  "miscellaneous",
];

/** Narrows a raw <select> value to a scope, or undefined for "all scopes". */
const parseScope = (value: string): MockTestScope | undefined =>
  (MOCK_TEST_SCOPE_VALUES as readonly string[]).includes(value)
    ? (value as MockTestScope)
    : undefined;

/**
 * A page of mock tests plus whether another page exists. Mirrors the
 * server result minus the cursor, which the caller keeps to itself.
 */
type SearchMockTests = (
  payload: SearchMockTestsFiltersPayload,
) => Promise<ServerActionResult<MockTestSearchResult>>;

interface UseMockTestsSearchOptions {
  /**
   * The view's pinned search action. Each page owns one — the creator flags
   * (`byAdmin` / `userId`) are decided inside it, never from the payload.
   */
  search: SearchMockTests;
  /**
   * First page already rendered by the server component. When present the
   * initial request is skipped, so the seeded rows are never blanked into a
   * skeleton on hydration.
   */
  initial?: MockTestSearchResult | null;
}

/**
 * Shared search state behind the student mock-test lists.
 *
 * Owns the debounced name search, the hierarchy filters, keyset pagination
 * (`nextCursor` is opaque and only ever replayed with the same filters) and
 * the stale-response guard that drops superseded requests. `search` never
 * accepts creator flags, so the list is scoped by construction.
 */
export function useMockTestsSearch({
  search,
  initial = null,
}: UseMockTestsSearchOptions) {
  /** Null until the first page arrives — drives the skeleton. */
  const [items, setItems] = useState<MockTestListItemProjection[] | null>(
    initial ? initial.items : null,
  );
  const [nextCursor, setNextCursor] = useState<string | null>(
    initial?.nextCursor ?? null,
  );
  const [hasNextPage, setHasNextPage] = useState(Boolean(initial?.hasNextPage));
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<MockTestsFilterState>({
    ...EMPTY_MOCK_TESTS_FILTERS,
  });

  const requestIdRef = useRef(0);
  // The server-rendered page only answers the *initial* (unfiltered) query.
  const hasInitialPageRef = useRef(initial !== null);

  /**
   * Loads the first page of a search. Stale responses (superseded by a
   * newer search) are dropped, and state is only touched from callbacks.
   */
  const runFirstPageSearch = useCallback(
    (query: SearchMockTestsFiltersPayload) => {
      const requestId = ++requestIdRef.current;

      search(query)
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
    [search],
  );

  // The exact query for the current filters — `cursor` continues a result.
  // `pageSize` is left to the service so the server-rendered first page and
  // every client page are cut at exactly the same size.
  const buildQuery = useCallback(
    (cursor: string | null): SearchMockTestsFiltersPayload => ({
      scope: parseScope(filters.scope),
      subjectId: filters.subjectId || undefined,
      sectionId: filters.sectionId || undefined,
      chapterId: filters.chapterId || undefined,
      search: debouncedSearch || undefined,
      cursor: cursor ?? undefined,
    }),
    [filters, debouncedSearch],
  );

  // Reload the first page whenever a filter or the debounced search changes.
  useEffect(() => {
    if (hasInitialPageRef.current) {
      hasInitialPageRef.current = false;
      return;
    }

    runFirstPageSearch(buildQuery(null));
  }, [buildQuery, runFirstPageSearch]);

  // Debounce the name search so typing does not fire a request per key.
  useEffect(() => {
    if (searchQuery === debouncedSearch) return;

    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setItems(null);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearch]);

  // The type ↔ hierarchy rules live in `filter-state.ts` so the admin
  // console filters exactly the same way.
  const handleFilterChange = useCallback(
    (key: keyof MockTestsFilterState, value: string) => {
      setFilters((prev) => applyMockTestFilterChange(prev, key, value));
      setItems(null);
    },
    [],
  );

  const clearFilters = useCallback(() => {
    const willChangeQuery =
      Boolean(
        filters.scope ||
          filters.subjectId ||
          filters.sectionId ||
          filters.chapterId,
      ) || debouncedSearch !== "";

    setFilters({ ...EMPTY_MOCK_TESTS_FILTERS });
    setSearchQuery("");
    setDebouncedSearch("");
    // Only blank the list when the query really changes — otherwise the
    // effect would not fire and the skeleton would never resolve.
    if (willChangeQuery) setItems(null);
  }, [filters, debouncedSearch]);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const res = await search(buildQuery(nextCursor));
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
  }, [nextCursor, isLoadingMore, search, buildQuery]);

  /** Re-runs the current query from the top (MocksNav refresh button). */
  const refresh = useCallback(() => {
    setItems(null);
    runFirstPageSearch(buildQuery(null));
  }, [runFirstPageSearch, buildQuery]);

  const hasActiveFilters = Boolean(
    filters.scope ||
      filters.subjectId ||
      filters.sectionId ||
      filters.chapterId ||
      searchQuery,
  );

  return {
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
  };
}

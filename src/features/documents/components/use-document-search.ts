"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { DocumentSearchData } from "../dto/projections";
import type { DocumentFilterProcessingStatus } from "../types";
import { getUserDocumentsAction } from "../actions/get-user-documents";
import { useDocumentUploaderContext } from "../uploads/document-uploader-provider";

export const DOCUMENTS_REFRESH_EVENT = "documents:refresh";

export interface SearchCacheEntry {
  items: DocumentSearchData[];
  cursor: string;
  hasMore: boolean;
}

/**
 * In-memory cache for document search queries and their cursor state.
 * Key format: `${searchKey.trim().toLowerCase()}::${processingStatus}`
 */
const queryCache = new Map<string, SearchCacheEntry>();

export function getDocumentSearchCacheKey(
  searchKey: string,
  processingStatus: string,
): string {
  return `${searchKey.trim().toLowerCase()}::${processingStatus}`;
}

export function useDocumentSearch() {
  const { notifyKnownDocuments } = useDocumentUploaderContext();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [processingStatus, setProcessingStatus] = useState<
    DocumentFilterProcessingStatus | ""
  >("");

  const [items, setItems] = useState<DocumentSearchData[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const requestIdRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(false);
  const activeCacheKeyRef = useRef("");

  cursorRef.current = cursor;
  hasMoreRef.current = hasMore;
  isLoadingMoreRef.current = isLoadingMore;

  // Debounce search query input (fast reset when cleared)
  useEffect(() => {
    if (!searchQuery) {
      setDebouncedSearchQuery("");
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Main fetch function for page 1 / query filter changes
  const fetchPage = useCallback(
    async (
      search: string,
      status: DocumentFilterProcessingStatus | "",
      skipCache = false,
    ) => {
      const cacheKey = getDocumentSearchCacheKey(search, status);
      activeCacheKeyRef.current = cacheKey;

      if (!skipCache && queryCache.has(cacheKey)) {
        const cached = queryCache.get(cacheKey)!;
        setItems(cached.items);
        setCursor(cached.cursor);
        setHasMore(cached.hasMore);
        setIsLoading(false);

        if (!search && !status) {
          notifyKnownDocuments(cached.items.map((d) => d.documentId));
        }
        return;
      }

      setIsLoading(true);
      setItems(null);
      setCursor(null);
      setHasMore(false);

      const requestId = ++requestIdRef.current;

      try {
        const result = await getUserDocumentsAction({
          searchKey: search.trim() || undefined,
          processingStatus: status || undefined,
          pagination: { pageSize: 20 },
        });

        if (requestIdRef.current !== requestId) {
          return;
        }

        if (result.success && result.data) {
          const docs = result.data.documents;
          const nextCursor = result.data.pagination.cursor;
          const nextHasMore = result.data.pagination.hasMore;

          setItems(docs);
          setCursor(nextCursor);
          setHasMore(nextHasMore);

          queryCache.set(cacheKey, {
            items: docs,
            cursor: nextCursor,
            hasMore: nextHasMore,
          });

          if (!search && !status) {
            notifyKnownDocuments(docs.map((d) => d.documentId));
          }
        } else {
          setItems([]);
          setCursor(null);
          setHasMore(false);
          if (!result.success) {
            toast.error(result.error.message || "Failed to load documents");
          }
        }
      } catch (error) {
        if (requestIdRef.current === requestId) {
          setItems([]);
          setCursor(null);
          setHasMore(false);
          console.error("Failed to load documents:", error);
          toast.error("Failed to load documents");
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [notifyKnownDocuments],
  );

  // Trigger page fetch whenever debouncedSearchQuery or processingStatus changes
  useEffect(() => {
    void fetchPage(debouncedSearchQuery, processingStatus);
  }, [debouncedSearchQuery, processingStatus, fetchPage]);

  // Load next page for infinite scrolling
  const loadMore = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMoreRef.current || !cursorRef.current) {
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    const currentKey = activeCacheKeyRef.current;
    const currentCursor = cursorRef.current;

    try {
      const result = await getUserDocumentsAction({
        searchKey: debouncedSearchQuery.trim() || undefined,
        processingStatus: processingStatus || undefined,
        pagination: {
          cursor: currentCursor,
          pageSize: 20,
        },
      });

      if (activeCacheKeyRef.current !== currentKey) {
        return;
      }

      if (result.success && result.data) {
        const nextDocs = result.data.documents;
        const nextCursor = result.data.pagination.cursor;
        const nextHasMore = result.data.pagination.hasMore;

        setItems((prev) => {
          const combined = [...(prev ?? []), ...nextDocs];
          queryCache.set(currentKey, {
            items: combined,
            cursor: nextCursor,
            hasMore: nextHasMore,
          });
          if (!debouncedSearchQuery && !processingStatus) {
            notifyKnownDocuments(combined.map((d) => d.documentId));
          }
          return combined;
        });

        setCursor(nextCursor);
        setHasMore(nextHasMore);
      } else if (!result.success) {
        toast.error(result.error.message || "Failed to load more documents");
      }
    } catch (error) {
      console.error("Failed to load more documents:", error);
      toast.error("Failed to load more documents");
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [debouncedSearchQuery, processingStatus, notifyKnownDocuments]);

  // Refresh handler: clears in-memory cache and re-fetches current view
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      queryCache.clear();
      await fetchPage(debouncedSearchQuery, processingStatus, true);
    } finally {
      setIsRefreshing(false);
    }
  }, [debouncedSearchQuery, processingStatus, fetchPage]);

  // Listen to refresh events (e.g. document creation coordinator)
  useEffect(() => {
    const handleRefreshEvent = () => {
      void refresh();
    };

    window.addEventListener(DOCUMENTS_REFRESH_EVENT, handleRefreshEvent);
    return () => {
      window.removeEventListener(DOCUMENTS_REFRESH_EVENT, handleRefreshEvent);
    };
  }, [refresh]);

  // Optimistic document deletion + cache sync
  const handleDocumentDeleted = useCallback((deletedId: string) => {
    setItems((prev) =>
      prev ? prev.filter((d) => d.documentId !== deletedId) : null,
    );
    for (const [key, entry] of queryCache.entries()) {
      if (entry.items.some((d) => d.documentId === deletedId)) {
        queryCache.set(key, {
          ...entry,
          items: entry.items.filter((d) => d.documentId !== deletedId),
        });
      }
    }
  }, []);

  // Optimistic document update + cache sync
  const handleDocumentUpdated = useCallback((updatedDoc: DocumentSearchData) => {
    setItems((prev) =>
      prev
        ? prev.map((d) =>
            d.documentId === updatedDoc.documentId ? updatedDoc : d,
          )
        : null,
    );
    for (const [key, entry] of queryCache.entries()) {
      if (entry.items.some((d) => d.documentId === updatedDoc.documentId)) {
        queryCache.set(key, {
          ...entry,
          items: entry.items.map((d) =>
            d.documentId === updatedDoc.documentId ? updatedDoc : d,
          ),
        });
      }
    }
  }, []);

  const isSearching =
    searchQuery !== debouncedSearchQuery || (isLoading && items !== null);

  return {
    items,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    processingStatus,
    setProcessingStatus,
    isLoading,
    isLoadingMore,
    isSearching,
    isRefreshing,
    hasMore,
    loadMore,
    refresh,
    handleDocumentDeleted,
    handleDocumentUpdated,
  };
}

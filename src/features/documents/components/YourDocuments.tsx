"use client";

import { useRef, useEffect, useState } from "react";
import { FileStack, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/patterns/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { createDocumentAction } from "../actions/create-document";
import { DocumentCard } from "./DocumentCard";
import { DocumentForm } from "./DocumentForm";
import { DocumentSearchBar } from "./DocumentSearchBar";
import { useDocumentSearch } from "./use-document-search";

function DocumentsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading documents"
      className="space-y-3"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-5 w-48 rounded" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-3/4 rounded" />
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-3 w-32 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading documents...</span>
    </div>
  );
}

export function YourDocuments() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const {
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
  } = useDocumentSearch();

  const hasActiveFilters = Boolean(
    debouncedSearchQuery.trim() || processingStatus,
  );

  // Setup infinite scroll observer on sentinel element
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          void loadMore();
        }
      },
      {
        root: null,
        rootMargin: "250px",
        threshold: 0,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <section className="space-y-4">
      <DocumentSearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        processingStatus={processingStatus}
        onProcessingStatusChange={setProcessingStatus}
        onRefresh={refresh}
        onCreateClick={() => setIsCreateOpen(true)}
        isSearching={isSearching}
        isRefreshing={isRefreshing}
      />

      <DocumentForm
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSumbitAction={createDocumentAction}
      />

      {isLoading ? (
        <DocumentsSkeleton />
      ) : !items || items.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title={
            hasActiveFilters
              ? "No documents match your filters"
              : "No documents uploaded yet"
          }
          description={
            hasActiveFilters
              ? "Try adjusting your search keywords or clearing the status filter."
              : "Upload study documents, past questions, or reference sheets to generate mock tests."
          }
          titleSize="md"
          className="min-h-[45vh] rounded-none border-0 bg-transparent p-12"
        />
      ) : (
        <div className="space-y-3">
          {items.map((doc) => (
            <div key={doc.documentId}>
              <DocumentCard
                document={doc}
                onDocumentDeleted={handleDocumentDeleted}
                onDocumentUpdated={handleDocumentUpdated}
              />
            </div>
          ))}

          {/* Sentinel for infinite scroll */}
          {hasMore && (
            <div
              ref={sentinelRef}
              className="h-6 w-full pointer-events-none"
              aria-hidden="true"
            />
          )}

          {/* Loading more spinner */}
          {isLoadingMore && (
            <div
              role="status"
              aria-label="Loading more documents"
              className="flex items-center justify-center py-4"
            >
              <Loader2 className="size-5 animate-spin text-brand" />
              <span className="sr-only">Loading more documents...</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

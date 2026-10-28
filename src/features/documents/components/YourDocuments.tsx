"use client";

import { useEffect, useState } from "react";
import { FileStack, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/patterns/empty-state";
import { cn } from "@/lib/utils";
import type { DocumentItemDTO } from "../actions/types";
import { getUserDocumentsAction } from "../actions/get-user-documents";
import { useDocumentUploaderContext } from "../uploads/document-uploader-provider";
import { DocumentCard } from "./DocumentCard";
import { isDocumentItem } from "./document-card-view";

interface YourDocumentsProps {
  initialDocuments?: DocumentItemDTO[];
}

/** Refetch signal (DocumentsNav refresh icon, coordinator completion). */
const DOCUMENTS_REFRESH_EVENT = "documents:refresh";
/** Instant-insert signal from the create form (full DTO in the detail). */
const DOCUMENTS_CREATED_EVENT = "documents:created";

/** How long the entrance animation flag stays on the newly added card. */
const ENTRANCE_ANIMATION_MS = 600;

export function YourDocuments({ initialDocuments = [] }: YourDocumentsProps) {
  const { notifyKnownDocuments } = useDocumentUploaderContext();
  const [documents, setDocuments] =
    useState<DocumentItemDTO[]>(initialDocuments);
  const [isLoading, setIsLoading] = useState(!initialDocuments.length);
  /** Card id currently playing its one-shot entrance animation. */
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  const fetchDocuments = async () => {
    try {
      const result = await getUserDocumentsAction();
      if (result.success && result.data) {
        setDocuments(result.data);
        // Lets the uploader purge stale IndexedDB sessions for docs that
        // no longer exist (deleted, or reclaimed by the stale-upload cron).
        notifyKnownDocuments(result.data.map((d) => d.id));
      }
    } catch (error) {
      console.error("Failed to fetch user documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();

    /**
     * DocumentsNav's refresh icon re-runs the server pass AND signals the
     * mounted list via this event (same pattern as the mocks refresh).
     */
    const handleRefresh = () => fetchDocuments();

    /**
     * Instant insertion from the create form: the payload is the EXACT
     * DocumentItemDTO the create action returned (same query + mapper as
     * this list uses), so the new card renders immediately with correct
     * files/aggregates — before any upload byte moves. Deduped: a later
     * refetch simply replaces it in place (no double entry, no re-animation).
     */
    const handleDocumentCreated = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      const created =
        !!detail &&
        typeof detail === "object" &&
        isDocumentItem((detail as { document?: unknown }).document)
          ? (detail as { document: DocumentItemDTO }).document
          : null;
      if (!created) return;

      setDocuments((prev) =>
        prev.some((d) => d.id === created.id) ? prev : [created, ...prev],
      );
      setRecentlyAddedId(created.id);
    };

    window.addEventListener(DOCUMENTS_REFRESH_EVENT, handleRefresh);
    window.addEventListener(DOCUMENTS_CREATED_EVENT, handleDocumentCreated);
    return () => {
      window.removeEventListener(DOCUMENTS_REFRESH_EVENT, handleRefresh);
      window.removeEventListener(DOCUMENTS_CREATED_EVENT, handleDocumentCreated);
    };
  }, []);

  // Retire the entrance-animation flag once it has played (setState in a
  // timeout callback — not synchronously in the effect body).
  useEffect(() => {
    if (!recentlyAddedId) return;
    const timer = setTimeout(
      () => setRecentlyAddedId(null),
      ENTRANCE_ANIMATION_MS,
    );
    return () => clearTimeout(timer);
  }, [recentlyAddedId]);

  const handleDocumentDeleted = (deletedId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== deletedId));
  };

  const handleDocumentUpdated = (updatedDoc: DocumentItemDTO) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)),
    );
  };

  return (
    <section className="space-y-3">
      {isLoading ? (
        <div
          role="status"
          aria-label="Loading documents"
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-10 text-center space-y-3 bg-card/40"
        >
          <Loader2 className="size-6 animate-spin text-brand" />
          <p className="text-xs text-muted-foreground">
            Loading your study documents...
          </p>
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title="No documents uploaded yet"
          titleSize="md"
          // Plain-background variant for this page: no dashed placeholder
          // box. min-height + the component's own centering keeps the
          // message vertically centered in the remaining page space.
          className="min-h-[45vh] rounded-none border-0 bg-transparent p-12"
        />
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={cn(
                doc.id === recentlyAddedId && "document-card-enter",
              )}
            >
              <DocumentCard
                document={doc}
                onDocumentDeleted={handleDocumentDeleted}
                onDocumentUpdated={handleDocumentUpdated}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

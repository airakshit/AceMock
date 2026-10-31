"use client";

import { useEffect, useState } from "react";
import { FileStack, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/patterns/empty-state";
import type { DocumentSearchData } from "../dto/projections";
import { getUserDocumentsAction } from "../actions/get-user-documents";
import { useDocumentUploaderContext } from "../uploads/document-uploader-provider";
import { DocumentCard } from "./DocumentCard";

interface YourDocumentsProps {
  initialDocuments?: DocumentSearchData[];
}

/** Refetch signal (DocumentsNav refresh icon, coordinator completion). */
const DOCUMENTS_REFRESH_EVENT = "documents:refresh";

export function YourDocuments({ initialDocuments }: YourDocumentsProps) {
  const { notifyKnownDocuments } = useDocumentUploaderContext();
  /** True when the server page already supplied the first snapshot. */
  const hasServerSnapshot = initialDocuments !== undefined;
  const [documents, setDocuments] = useState<DocumentSearchData[]>(
    initialDocuments ?? [],
  );
  const [isLoading, setIsLoading] = useState(!hasServerSnapshot);

  const fetchDocuments = async () => {
    try {
      const result = await getUserDocumentsAction();
      if (result.success && result.data) {
        // getUserDocumentsAction now returns DocumentSearchQueryResponse { documents, pagination }
        const docs = result.data.documents;
        setDocuments(docs);
        // Lets the uploader purge stale IndexedDB sessions for docs that
        // no longer exist (deleted, or reclaimed by the stale-upload cron).
        notifyKnownDocuments(docs.map((d) => d.documentId));
      }
    } catch (error) {
      console.error("Failed to fetch user documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasServerSnapshot) {
      // First payload came with the server render — only purge stale local
      // sessions here (no network round trip during hydration).
      notifyKnownDocuments((initialDocuments ?? []).map((d) => d.documentId));
    } else {
      void fetchDocuments();
    }

    /**
     * DocumentsNav's refresh icon re-runs the server pass AND signals the
     * mounted list via this event (same pattern as the mocks refresh).
     */
    const handleRefresh = () => void fetchDocuments();

    window.addEventListener(DOCUMENTS_REFRESH_EVENT, handleRefresh);
    return () => {
      window.removeEventListener(DOCUMENTS_REFRESH_EVENT, handleRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDocumentDeleted = (deletedId: string) => {
    setDocuments((prev) => prev.filter((d) => d.documentId !== deletedId));
  };

  const handleDocumentUpdated = (updatedDoc: DocumentSearchData) => {
    setDocuments((prev) =>
      prev.map((d) => (d.documentId === updatedDoc.documentId ? updatedDoc : d)),
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
            <div key={doc.documentId}>
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
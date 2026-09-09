"use client";

import { useEffect, useState, useTransition } from "react";
import { FileStack, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import type { DocumentItemDTO } from "../actions/types";
import { getUserDocumentsAction } from "../actions/get-user-documents";
import { DocumentCard } from "./DocumentCard";

interface YourDocumentsProps {
  initialDocuments?: DocumentItemDTO[];
}

export function YourDocuments({ initialDocuments = [] }: YourDocumentsProps) {
  const [documents, setDocuments] =
    useState<DocumentItemDTO[]>(initialDocuments);
  const [isLoading, setIsLoading] = useState(!initialDocuments.length);
  const [isPending, startTransition] = useTransition();

  const fetchDocuments = async () => {
    try {
      const result = await getUserDocumentsAction();
      if (result.success && result.data) {
        setDocuments(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch user documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleRefresh = () => {
    startTransition(async () => {
      await fetchDocuments();
    });
  };

  const handleDocumentDeleted = (deletedId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== deletedId));
  };

  const handleDocumentUpdated = (updatedDoc: DocumentItemDTO) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)),
    );
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2 pb-1">
        <div className="flex items-center gap-2.5">
          <h3 className={typography.sectionTitle}>Your Documents</h3>
          {documents.length > 0 && (
            <Badge variant="secondary" className="text-xs font-medium border border-border/50">
              {documents.length}{" "}
              {documents.length === 1 ? "file" : "files"}
            </Badge>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isPending || isLoading}
          className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
          title="Refresh document list"
        >
          <RefreshCw
            className={cn(
              "size-3.5",
              (isPending || isLoading) && "animate-spin",
            )}
          />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-10 text-center space-y-3 bg-card/40">
          <Loader2 className="size-6 animate-spin text-brand" />
          <p className="text-xs text-muted-foreground">
            Loading your study documents...
          </p>
        </div>
      ) : documents.length === 0 ? (
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-10 text-center space-y-3 bg-card/40",
            typography.bodyMuted,
          )}
        >
          <div className="flex size-12 items-center justify-center rounded-full border border-border/60 bg-muted/60 text-muted-foreground">
            <FileStack className="size-6 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            No documents uploaded yet
          </p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Upload syllabi, past question papers, or study notes above to automatically generate targeted mock questions.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onDocumentDeleted={handleDocumentDeleted}
              onDocumentUpdated={handleDocumentUpdated}
            />
          ))}
        </div>
      )}
    </section>
  );
}

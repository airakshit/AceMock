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
    const [documents, setDocuments] = useState<DocumentItemDTO[]>(initialDocuments);
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

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <h3 className={typography.sectionTitle}>Your Documents</h3>
                    {documents.length > 0 && (
                        <Badge variant="secondary" className="text-xs font-mono">
                            {documents.length} {documents.length === 1 ? "document" : "documents"}
                        </Badge>
                    )}
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isPending || isLoading}
                    className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                    title="Refresh document list"
                >
                    <RefreshCw
                        className={cn("size-3.5", (isPending || isLoading) && "animate-spin")}
                    />
                    <span className="hidden sm:inline">Refresh</span>
                </Button>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center space-y-2">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Loading your documents...</p>
                </div>
            ) : documents.length === 0 ? (
                <div
                    className={cn(
                        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center space-y-2",
                        typography.bodyMuted,
                    )}
                >
                    <div className="flex size-10 items-center justify-center rounded-full border bg-muted/50">
                        <FileStack className="size-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">No documents yet</p>
                    <p className="text-xs text-muted-foreground">
                        Start by creating a document above.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {documents.map((doc) => (
                        <DocumentCard key={doc.id} document={doc} />
                    ))}
                </div>
            )}
        </section>
    );
}

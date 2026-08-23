"use client";

import { useState } from "react";
import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    FileText,
    Image as ImageIcon,
    Loader2,
    Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DocumentItemDTO } from "../actions/types";
import type { DocumentStatus } from "../types";
import { formatBytes, formatDate } from "../utils";

interface DocumentCardProps {
    document: DocumentItemDTO;
}

const statusConfig: Record<
    DocumentStatus,
    { label: string; className: string; icon: React.ElementType }
> = {
    ready: {
        label: "Ready",
        className:
            "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400",
        icon: CheckCircle2,
    },
    uploading: {
        label: "Uploading",
        className:
            "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-400",
        icon: Loader2,
    },
    processing: {
        label: "Processing",
        className:
            "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-400",
        icon: Sparkles,
    },
    draft: {
        label: "Draft",
        className:
            "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
        icon: Clock,
    },
    failed: {
        label: "Failed",
        className:
            "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-400",
        icon: AlertTriangle,
    },
    deleted: {
        label: "Deleted",
        className:
            "border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500 line-through",
        icon: AlertTriangle,
    },
};

const contentTypeLabels: Record<string, string> = {
    physics: "Physics",
    maths: "Maths",
    chemistry: "Chemistry",
    english: "English",
    "mock-test": "Mock Test",
    "study-notes": "Study Notes",
};

export function DocumentCard({ document }: DocumentCardProps) {
    const [isFilesOpen, setIsFilesOpen] = useState(false);

    const statusInfo = statusConfig[document.status] || statusConfig.draft;
    const StatusIcon = statusInfo.icon;

    const pdfCount = document.files.filter((f) => f.fileType === "pdf").length;
    const imageCount = document.files.filter((f) => f.fileType === "image").length;
    const totalSize = document.files.reduce((acc, f) => acc + (f.fileSize || 0), 0);

    return (
        <div className="w-full rounded-xl border bg-card text-card-foreground shadow-2xs hover:border-primary/30 transition-all duration-200 overflow-hidden">
            {/* Main horizontal content row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-4">
                {/* Left section: Info, Title, Badges */}
                <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Content Type Badge */}
                        <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                            {contentTypeLabels[document.contentType] || document.contentType}
                        </span>

                        {/* Status Badge with custom colors */}
                        <span
                            className={cn(
                                "inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors",
                                statusInfo.className,
                            )}
                        >
                            <StatusIcon
                                className={cn(
                                    "size-3.5",
                                    document.status === "uploading" && "animate-spin",
                                    document.status === "processing" && "animate-pulse",
                                )}
                            />
                            <span>{statusInfo.label}</span>
                        </span>

                        {/* Created Date */}
                        <span className="text-xs text-muted-foreground ml-auto sm:ml-0">
                            {formatDate(document.createdAt)}
                        </span>
                    </div>

                    {/* Title */}
                    <h4 className="text-base sm:text-lg font-bold text-foreground truncate tracking-tight">
                        {document.title}
                    </h4>

                    {/* Description */}
                    {document.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {document.description}
                        </p>
                    )}

                    {/* Files Summary */}
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground font-mono">
                        {pdfCount > 0 && (
                            <span className="inline-flex items-center gap-1">
                                <FileText className="size-3.5 text-rose-500" />
                                {pdfCount} {pdfCount === 1 ? "PDF" : "PDFs"}
                            </span>
                        )}

                        {imageCount > 0 && (
                            <span className="inline-flex items-center gap-1">
                                <ImageIcon className="size-3.5 text-blue-500" />
                                {imageCount} {imageCount === 1 ? "Image" : "Images"}
                            </span>
                        )}

                        {totalSize > 0 && (
                            <span className="text-muted-foreground/70">
                                Total: {formatBytes(totalSize)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right section: Action toggle */}
                {document.files.length > 0 && (
                    <div className="flex items-center justify-between sm:justify-end shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsFilesOpen(!isFilesOpen)}
                            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                            <span>{isFilesOpen ? "Hide Files" : "View Files"}</span>
                            {isFilesOpen ? (
                                <ChevronUp className="size-4" />
                            ) : (
                                <ChevronDown className="size-4" />
                            )}
                        </Button>
                    </div>
                )}
            </div>

            {/* Expandable Files List */}
            {isFilesOpen && document.files.length > 0 && (
                <div className="border-t bg-muted/30 p-3 sm:p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                        Attached Files ({document.files.length})
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {document.files.map((file) => {
                            const isPdf = file.fileType === "pdf";
                            const FileIcon = isPdf ? FileText : ImageIcon;

                            return (
                                <div
                                    key={file.id}
                                    className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2.5 text-xs transition-colors hover:bg-card/80"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="flex size-7 items-center justify-center rounded-md border bg-background shrink-0">
                                            <FileIcon
                                                className={cn(
                                                    "size-3.5",
                                                    isPdf ? "text-rose-500" : "text-blue-500",
                                                )}
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium text-foreground truncate max-w-[180px] sm:max-w-[220px]">
                                                {file.originalFilename}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground font-mono">
                                                {formatBytes(file.fileSize)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* File status badge */}
                                    <span
                                        className={cn(
                                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase font-mono",
                                            file.status === "uploaded"
                                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                                                : file.status === "uploading"
                                                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                                                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400",
                                        )}
                                    >
                                        {file.status}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

"use client";

import { Plus, RotateCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/patterns/search-input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import type { DocumentFilterProcessingStatus } from "../types";

interface DocumentSearchBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  processingStatus: DocumentFilterProcessingStatus | "";
  onProcessingStatusChange: (
    status: DocumentFilterProcessingStatus | "",
  ) => void;
  onRefresh: () => void;
  onCreateClick: () => void;
  isSearching?: boolean;
  isRefreshing?: boolean;
}

export function DocumentSearchBar({
  searchQuery,
  onSearchChange,
  processingStatus,
  onProcessingStatusChange,
  onRefresh,
  onCreateClick,
  isSearching = false,
  isRefreshing = false,
}: DocumentSearchBarProps) {
  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
      {/* Search Input - full width on mobile, flexible on desktop */}
      <div className="relative flex-1 min-w-0">
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search documents by title or description..."
          label="Search documents"
        />
        {isSearching && (
          <div className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2">
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Action controls: Status Filter + Refresh + Create */}
      <div className="flex items-center gap-2">
        <div className="flex-1 sm:flex-initial sm:w-[175px] min-w-0">
          <NativeSelect
            value={processingStatus}
            onChange={(e) =>
              onProcessingStatusChange(
                e.target.value as DocumentFilterProcessingStatus | "",
              )
            }
            className="w-full [&_select]:h-9"
            aria-label="Filter by processing status"
          >
            <NativeSelectOption value="">All Statuses</NativeSelectOption>
            <NativeSelectOption value="pending">Pending</NativeSelectOption>
            <NativeSelectOption value="queued">Queued</NativeSelectOption>
            <NativeSelectOption value="processing">Processing</NativeSelectOption>
            <NativeSelectOption value="completed">Completed</NativeSelectOption>
            <NativeSelectOption value="failed">Failed</NativeSelectOption>
          </NativeSelect>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh documents"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <RotateCw className={cn("size-4", isRefreshing && "animate-spin")} />
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={onCreateClick}
          className="gap-1.5 shrink-0 h-9 px-3"
        >
          <Plus className="size-4" />
          <span>Create</span>
        </Button>
      </div>
    </div>
  );
}

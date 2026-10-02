"use client";

import { Bookmark, Lightbulb } from "lucide-react";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { CURRICULUM } from "@/constants/curriculum";

interface BookmarkFiltersProps {
  /** Empty string = all subjects. */
  subjectSlug: string;

  /** When true, each page arrives with correct option + solution loaded. */
  includeSolution: boolean;

  onSubjectChange: (slug: string) => void;
  onIncludeSolutionChange: (include: boolean) => void;
  disabled?: boolean;
}

const SUBJECT_OPTIONS = Object.values(CURRICULUM).map((subject) => ({
  slug: subject.slug,
  name: subject.name,
}));

export function BookmarkFilters({
  subjectSlug,
  includeSolution,
  onSubjectChange,
  onIncludeSolutionChange,
  disabled = false,
}: BookmarkFiltersProps) {
  return (
    <div className="rounded-2xl border bg-card/60 p-3 shadow-sm backdrop-blur-sm sm:p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Decorative icon */}
        <div className="hidden shrink-0 sm:block">
          <Bookmark className="size-4 text-brand" aria-hidden="true" />
        </div>

        {/* Subject */}
        <div className="min-w-0 flex-1">
          <label htmlFor="bookmark-subject-filter" className="sr-only">
            Subject
          </label>

          <NativeSelect
            id="bookmark-subject-filter"
            size="sm"
            value={subjectSlug}
            onChange={(e) => onSubjectChange(e.target.value)}
            disabled={disabled}
            className="w-full"
          >
            <NativeSelectOption value="">All subjects</NativeSelectOption>

            {SUBJECT_OPTIONS.map((subject) => (
              <NativeSelectOption key={subject.slug} value={subject.slug}>
                {subject.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        {/* Solution toggle */}
        <div className="flex min-w-0 items-center justify-between gap-3 sm:w-auto sm:justify-start">
          <div className="flex min-w-0 items-center gap-2">
            <Lightbulb
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />

            <div className="min-w-0">
              <div className="text-xs font-medium">Solution</div>

              <div className="text-xs text-muted-foreground">
                {includeSolution ? "Loaded with page" : "Loaded on demand"}
              </div>
            </div>
          </div>

          <Switch
            id="bookmark-solution-toggle"
            size="sm"
            checked={includeSolution}
            onCheckedChange={onIncludeSolutionChange}
            disabled={disabled}
            aria-label="Load solutions with page"
            className="shrink-0"
          />
        </div>
      </div>
    </div>
  );
}

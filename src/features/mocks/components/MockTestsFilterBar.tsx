"use client";

import { useEffect, useMemo, useState } from "react";
import { ListFilter, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/patterns/search-input";
import { HierarchyFilterChips } from "@/components/patterns/hierarchy-filter-chips";
import { getCurriculumOptionsAction } from "@/features/questions/actions";
import type { CurriculumOptionsProjection } from "@/features/questions/dto/projections";
import { isHierarchyScope } from "../filter-state";
// Same option list (and the same wording) the custom-test form and the
// admin console show, so the three never drift apart.
import { SCOPE_CHIP_OPTIONS } from "../schemas";
import type { MockTestsFilterState } from "./use-mock-tests-search";

const EMPTY_CURRICULUM: CurriculumOptionsProjection = {
  subjects: [],
  sections: [],
  chapters: [],
};

interface MockTestsFilterBarProps {
  filters: MockTestsFilterState;
  onFilterChange: (key: keyof MockTestsFilterState, value: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  /** Right-hand status chip, e.g. "12 shown" or "Searching…". */
  resultLabel?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
}

/**
 * Search + two-level filter bar shared by the student mock-test lists.
 *
 * Level 1 is the type tag row — All · IOE Model · SubjectWise · SectionWise
 * · ChapterWise · Miscellaneous. Level 2 (subject → section → chapter chips)
 * exists only under the *Wise types: All, IOE Model and Miscellaneous store
 * no curriculum ids, so their hierarchy rows never show — and the shared
 * coupling rules (`filter-state.ts`) clear any picks when the tag moves
 * there, so nothing can keep filtering invisibly.
 *
 * Within level 2 the hierarchy still reveals one row at a time — subject
 * chips first, section chips only after a subject is picked, chapter chips
 * only after a section — and each row scrolls horizontally on phones
 * instead of wrapping, keeping the card compact on every device.
 *
 * The type tags are not fully independent of level 2: picking a hierarchy
 * chip moves the tag to match it (a chapter pick means ChapterWise),
 * because a test's type and the hierarchy levels it stores are the same
 * fact.
 *
 * The hierarchy options (subjects → sections → chapters) load here rather
 * than in each view: they are the data behind these chips and nothing else.
 */
export function MockTestsFilterBar({
  filters,
  onFilterChange,
  searchQuery,
  onSearchChange,
  onClear,
  hasActiveFilters,
  resultLabel,
  searchLabel = "Search mock tests",
  searchPlaceholder = "Search by test name...",
}: MockTestsFilterBarProps) {
  const [curriculum, setCurriculum] =
    useState<CurriculumOptionsProjection | null>(null);

  useEffect(() => {
    let isMounted = true;

    getCurriculumOptionsAction()
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setCurriculum(res.data.curriculum);
        } else {
          setCurriculum(EMPTY_CURRICULUM);
          toast.error(res.error.message || "Failed to load curriculum.");
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setCurriculum(EMPTY_CURRICULUM);
        toast.error("An error occurred while loading the curriculum.");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const availableSections = useMemo(
    () =>
      filters.subjectId
        ? (curriculum?.sections ?? []).filter(
            (s) => s.subjectId === filters.subjectId,
          )
        : [],
    [curriculum, filters.subjectId],
  );

  const availableChapters = useMemo(
    () =>
      filters.sectionId
        ? (curriculum?.chapters ?? []).filter(
            (c) => c.sectionId === filters.sectionId,
          )
        : [],
    [curriculum, filters.sectionId],
  );

  return (
    <div className="rounded-xl border border-border/80 bg-card p-3 shadow-card sm:p-4">
      {/* Name search + live status */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          label={searchLabel}
          placeholder={searchPlaceholder}
          className="sm:max-w-sm lg:max-w-md"
        />

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          {resultLabel && (
            <span className="rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground tabular-nums">
              {resultLabel}
            </span>
          )}

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-8 gap-1 text-xs text-muted-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
              <span>Clear</span>
            </Button>
          )}
        </div>
      </div>

      {/* Two levels: the type tags first; the subject → section → chapter
          rows only exist under the *Wise types */}
      <div className="mt-3 border-t border-border/60 pt-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ListFilter className="size-3.5" aria-hidden="true" />
          <span>Filters</span>
        </span>

        <div className="mt-1 space-y-1">
          <HierarchyFilterChips
            label="Type"
            options={SCOPE_CHIP_OPTIONS}
            value={filters.scope}
            onChange={(value) => onFilterChange("scope", value)}
            allLabel="All"
          />

          {isHierarchyScope(filters.scope) && (
            <>
              <HierarchyFilterChips
                label="Subject"
                options={curriculum?.subjects ?? []}
                value={filters.subjectId}
                onChange={(value) => onFilterChange("subjectId", value)}
                allLabel="All subjects"
                loading={curriculum === null}
                emptyLabel={
                  curriculum === null
                    ? "Loading subjects…"
                    : "No subjects found"
                }
              />

              {filters.subjectId && (
                <HierarchyFilterChips
                  label="Section"
                  options={availableSections}
                  value={filters.sectionId}
                  onChange={(value) => onFilterChange("sectionId", value)}
                  allLabel="All sections"
                  emptyLabel="No sections in this subject"
                />
              )}

              {filters.sectionId && (
                <HierarchyFilterChips
                  label="Chapter"
                  options={availableChapters}
                  value={filters.chapterId}
                  onChange={(value) => onFilterChange("chapterId", value)}
                  allLabel="All chapters"
                  emptyLabel="No chapters in this section"
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

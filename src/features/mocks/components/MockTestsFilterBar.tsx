"use client";

import { useEffect, useMemo, useState } from "react";
import { ListFilter, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { SearchInput } from "@/components/patterns/search-input";
import { getCurriculumOptionsAction } from "@/features/questions/actions";
import type { CurriculumOptionsProjection } from "@/features/questions/dto/projections";
// Same option list (and the same wording) the custom-test form shows, so the
// two never drift apart.
import { SCOPE_OPTIONS } from "../schemas";
import type { MockTestsFilterState } from "./use-mock-tests-search";

const EMPTY_CURRICULUM: CurriculumOptionsProjection = {
  subjects: [],
  sections: [],
  chapters: [],
};

interface FilterField {
  key: keyof MockTestsFilterState;
  label: string;
  placeholder: string;
  disabled?: boolean;
  options: { value: string; label: string }[];
}

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
 * Search + test type / hierarchy filter bar shared by the student mock-test
 * lists.
 *
 * Reads as one row on desktop (search and status on top, filters in a
 * 4-up grid below) and collapses to a single full-width column on phones,
 * so every select stays a comfortable touch target.
 *
 * "Test Type" is not an independent choice: picking a subject / section /
 * chapter moves it automatically (see `handleFilterChange` in
 * `useMockTestsSearch`), because a test's type and the hierarchy levels it
 * stores are the same fact.
 *
 * The hierarchy options (subjects → sections → chapters) load here rather
 * than in each view: they are the data behind these selects and nothing else.
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

  // The subject is always offered; section/chapter unlock one level at a
  // time so a user never has to guess why a select is empty.
  const fields: FilterField[] = [
    {
      key: "scope",
      label: "Test Type",
      placeholder: "All test types",
      options: SCOPE_OPTIONS,
    },
    {
      key: "subjectId",
      label: "Subject",
      placeholder: curriculum === null ? "Loading subjects…" : "All subjects",
      options: (curriculum?.subjects ?? []).map((subject) => ({
        value: subject.id,
        label: subject.name,
      })),
    },
    {
      key: "sectionId",
      label: "Section",
      placeholder: filters.subjectId ? "All sections" : "Pick a subject first",
      disabled: !filters.subjectId,
      options: availableSections.map((section) => ({
        value: section.id,
        label: section.name,
      })),
    },
    {
      key: "chapterId",
      label: "Chapter",
      placeholder: filters.sectionId ? "All chapters" : "Pick a section first",
      disabled: !filters.sectionId,
      options: availableChapters.map((chapter) => ({
        value: chapter.id,
        label: chapter.name,
      })),
    },
  ];

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

      {/* Test type + hierarchy — full width on phones, one row from lg up */}
      <div className="mt-3 border-t border-border/60 pt-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ListFilter className="size-3.5" aria-hidden="true" />
          <span>Filters</span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map((field) => (
            <div key={field.key} className="min-w-0 space-y-1">
              <label
                htmlFor={`mock-filter-${field.key}`}
                className="block text-[11px] font-medium text-muted-foreground"
              >
                {field.label}
              </label>
              <NativeSelect
                id={`mock-filter-${field.key}`}
                value={filters[field.key]}
                onChange={(e) => onFilterChange(field.key, e.target.value)}
                disabled={field.disabled}
                // Phones get a 44px tap target; from sm up the bar tightens
                // back to the toolbar height used elsewhere.
                className="w-full [&>select]:h-11 sm:[&>select]:h-9"
              >
                <NativeSelectOption value="">{field.placeholder}</NativeSelectOption>
                {field.options.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

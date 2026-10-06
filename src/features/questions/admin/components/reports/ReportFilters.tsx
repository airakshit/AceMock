"use client";

import { CalendarDays, ListFilter, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  QUESTION_REPORT_OPTIONS,
  type QuestionReportType,
} from "../../../../shared/components/question-card/types";

/** Controlled filter values for the admin reports list. */
export interface ReportFiltersState {
  /** Empty string = every report category. */
  reportType: QuestionReportType | "";
  /** `YYYY-MM-DD`, inclusive start of the window; empty = unbounded. */
  dateFrom: string;
  /** `YYYY-MM-DD`, inclusive end of the window; empty = unbounded. */
  dateTo: string;
}

export const EMPTY_REPORT_FILTERS: ReportFiltersState = {
  reportType: "",
  dateFrom: "",
  dateTo: "",
};

interface ReportFiltersProps {
  filters: ReportFiltersState;
  onChange: (key: keyof ReportFiltersState, value: string) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  /** Right-hand status chip, e.g. "14 shown". */
  resultLabel?: string;
  disabled?: boolean;
}

/**
 * Report type + date-range filters for `/admin/questions/reports`.
 *
 * Reads as one row on desktop and collapses to a single full-width column
 * on phones, so the date inputs keep a comfortable touch target. The
 * report-type select is driven by `QUESTION_REPORT_OPTIONS`, the same
 * list the report menu and the summary strip use — one source for the
 * category labels everywhere.
 */
export function ReportFilters({
  filters,
  onChange,
  onClear,
  hasActiveFilters,
  resultLabel,
  disabled = false,
}: ReportFiltersProps) {
  const fields = [
    {
      key: "dateFrom" as const,
      label: "From",
      type: "date" as const,
      value: filters.dateFrom,
    },
    {
      key: "dateTo" as const,
      label: "To",
      type: "date" as const,
      value: filters.dateTo,
    },
  ];

  return (
    <div className="rounded-xl border border-border/80 bg-card p-3 shadow-card sm:p-4">
      {/* Header: label + live status + clear */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ListFilter className="size-3.5" aria-hidden="true" />
          <span>Filters</span>
        </div>

        <div className="flex items-center justify-end gap-2">
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
              disabled={disabled}
              className="h-8 gap-1 text-xs text-muted-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
              <span>Clear</span>
            </Button>
          )}
        </div>
      </div>

      {/* Report type + date window — stacked on phones, one row from sm up */}
      <div className="mt-3 grid grid-cols-1 gap-2.5 border-t border-border/60 pt-3 sm:grid-cols-3">
        <div className="min-w-0 space-y-1">
          <label
            htmlFor="report-type-filter"
            className="block text-[11px] font-medium text-muted-foreground"
          >
            Report type
          </label>
          <NativeSelect
            id="report-type-filter"
            value={filters.reportType}
            onChange={(e) => onChange("reportType", e.target.value)}
            disabled={disabled}
            className="w-full [&>select]:h-11 sm:[&>select]:h-9"
          >
            <NativeSelectOption value="">All report types</NativeSelectOption>
            {QUESTION_REPORT_OPTIONS.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        {fields.map((field) => (
          <div key={field.key} className="min-w-0 space-y-1">
            <label
              htmlFor={`report-${field.key}-filter`}
              className="block text-[11px] font-medium text-muted-foreground"
            >
              {field.label}
            </label>
            <Input
              id={`report-${field.key}-filter`}
              type={field.type}
              value={field.value}
              onChange={(e) => onChange(field.key, e.target.value)}
              disabled={disabled}
              // Localised date inputs render the picker icon on the right;
              // keep the label from colliding with it.
              className="h-11 w-full px-2.5 sm:h-9"
            />
          </div>
        ))}
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <CalendarDays className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        <span>
          Each date covers a whole UTC day (&quot;From&quot; starts at 00:00,
          &quot;To&quot; ends at 23:59). A question matches when at least one
          of its reports falls inside the window.
        </span>
      </p>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { cn } from "@/lib/utils";

export interface HierarchyOption {
  id: string;
  name: string;
}

interface HierarchyFilterChipsProps {
  /** Short level name shown beside the row: Subject / Section / Chapter. */
  label: string;
  options: HierarchyOption[];
  /** Selected id, or "" for none / "All". */
  value: string;
  onChange: (value: string) => void;
  /** Leading "All" chip that clears the level — filter bars only. */
  allLabel?: string;
  /** Hint shown when the level has no options at all. */
  emptyLabel?: string;
  /** Skeleton chips while the option list loads. */
  loading?: boolean;
  disabled?: boolean;
  /** Marks the level mandatory (creation forms) with a red asterisk. */
  required?: boolean;
  /** Validation message rendered under the row. */
  error?: string;
  className?: string;
}

/**
 * HierarchyFilterChips — one row of the incremental subject → section →
 * chapter picker.
 *
 * The caller reveals rows one level at a time (subject first; sections only
 * after a subject; chapters only after a section), so the control never
 * overwhelms the page. Options render as horizontally scrollable chips —
 * on phones the row scrolls sideways instead of wrapping into a wall of
 * selects, and inactive chips keep full-contrast text so the smallest
 * labels stay readable.
 */
export function HierarchyFilterChips({
  label,
  options,
  value,
  onChange,
  allLabel,
  emptyLabel,
  loading = false,
  disabled = false,
  required = false,
  error,
  className,
}: HierarchyFilterChipsProps) {
  const attachDragScroll = useDragScroll<HTMLDivElement>();

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:w-16">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </span>

        <div
          ref={attachDragScroll}
          role="group"
          aria-label={label}
          className="drag-scroll scrollbar-light flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1"
        >
          {loading ? (
            <>
              <Skeleton className="h-7 w-16 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-14 rounded-full" />
            </>
          ) : options.length === 0 ? (
            <span className="py-1 text-xs font-medium text-muted-foreground">
              {emptyLabel}
            </span>
          ) : (
            <>
              {allLabel !== undefined && (
                <Chip
                  active={value === ""}
                  disabled={disabled}
                  onClick={() => onChange("")}
                >
                  {allLabel}
                </Chip>
              )}
              {options.map((option) => (
                <Chip
                  key={option.id}
                  active={value === option.id}
                  disabled={disabled}
                  onClick={() => onChange(option.id)}
                >
                  {option.name}
                </Chip>
              ))}
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-0.5 text-xs font-medium text-destructive sm:pl-[4.75rem]">
          {error}
        </p>
      )}
    </div>
  );
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "h-7 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-2xs"
          : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {children}
    </button>
  );
}

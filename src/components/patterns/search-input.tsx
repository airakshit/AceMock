"use client";

import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Placeholder text — also used as the accessible label unless `label` is given. */
  placeholder?: string;
  /** Explicit accessible label for screen readers. */
  label?: string;
  className?: string;
}

/**
 * SearchInput — the single search field pattern used across toolbars.
 *
 * Guarantees a consistent height, brand focus ring, leading icon, and an
 * accessible clear button so every list/search surface feels identical.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  label,
  className,
}: SearchInputProps) {
  return (
    <div className={cn("group relative w-full min-w-0", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-brand"
        aria-hidden="true"
      />
      <input
        type="text"
        role="searchbox"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        className="h-9 w-full min-w-0 rounded-lg border border-border bg-background pr-9 pl-9 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-brand/40 focus:outline-none focus:ring-3 focus:ring-brand/15"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

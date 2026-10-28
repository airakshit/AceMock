import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Optional action buttons rendered below the description. */
  children?: React.ReactNode;
  /**
   * Title font size — lets full-page empty states opt into larger type
   * while compact in-list states keep the small default.
   * @default "sm"
   */
  titleSize?: "sm" | "md" | "lg";
  className?: string;
}

const TITLE_SIZE_CLASSES = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
} as const;

/**
 * EmptyState — the single pattern for "nothing here yet" / "no results".
 *
 * Keeps icon treatment, spacing, and copy hierarchy identical across every
 * list surface (dashboard, mocks, documents, admin inspector).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  titleSize = "sm",
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-brand-muted text-brand">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <p className={cn("font-semibold text-foreground", TITLE_SIZE_CLASSES[titleSize])}>
        {title}
      </p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}

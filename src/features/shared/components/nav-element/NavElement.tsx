"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface NavElementItem {
  /** Stable identifier matched against `active`. */
  key: string;
  /** Visible label (plain bold text, green underline when active). */
  label: string;
  /** Destination the label navigates to. */
  href: string;
}

interface NavElementProps {
  /** The sections; each rendered as a plain Link with the underline treatment. */
  items: NavElementItem[];
  /** The `key` of the currently selected section. */
  active: string;
  /** Accessible name for the <nav> landmark (required for one). */
  ariaLabel: string;
  /**
   * Optional hook fired on every link navigation — used by owners that keep
   * extra state in sync when the user switches sections (e.g. re-fetch of a
   * kept-alive neighboring view).
   */
  onNavigate?: () => void;
  className?: string;
}

/**
 * NavElement — the shared page-level mini-navbar pattern.
 *
 * Plain bold labels with no pill/box treatment so they read identically in
 * light and dark themes; the selected section carries a green underline.
 * Navigation is real (Link), and the design language is shared by the mocks
 * hub and the documents page.
 */
export function NavElement({
  items,
  active,
  ariaLabel,
  onNavigate,
  className,
}: NavElementProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn("flex items-center gap-4 sm:gap-6", className)}
    >
      {items.map((item) => {
        const isActive = item.key === active;

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "relative text-sm font-bold tracking-tight transition-colors",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {isActive ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 -bottom-1.5 h-0.75 rounded-full bg-success"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

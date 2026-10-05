"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MocksSectionKey = "tests" | "custom" | "history";

interface MocksNavProps {
  /** Which section label is currently selected. */
  active: MocksSectionKey;
}

const MOCKS_SECTIONS: { key: MocksSectionKey; label: string; href: string }[] = [
  { key: "tests", label: "Tests", href: "/mocks/tests" },
  { key: "custom", label: "Custom", href: "/mocks/custom" },
  { key: "history", label: "My History", href: "/mocks/history" },
];

/**
 * MocksNav — section navigation shared by the mock-test pages.
 *
 * Plain bold labels with no pill/box treatment so they read identically in
 * light and dark themes; the active section carries a green underline. An
 * icon-only refresh sits at the far right of the same row — it re-runs the
 * server pass and signals the mounted view (`mocks:refresh` event) to
 * re-fetch its data in place.
 */
export function MocksNav({ active }: MocksNavProps) {
  const router = useRouter();

  const handleRefresh = () => {
    router.refresh();
    window.dispatchEvent(new Event("mocks:refresh"));
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <nav
        aria-label="Mock test sections"
        className="flex items-center gap-4 sm:gap-6"
      >
        {MOCKS_SECTIONS.map((section) => {
          const isActive = section.key === active;

          return (
            <Link
              key={section.key}
              href={section.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative text-sm font-bold tracking-tight transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {section.label}
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-1.5 h-[3px] rounded-full bg-success"
                />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleRefresh}
        aria-label="Refresh section"
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <RotateCw className="size-4" />
      </Button>
    </div>
  );
}

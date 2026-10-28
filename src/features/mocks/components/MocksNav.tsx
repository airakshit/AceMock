"use client";

import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NavElement } from "@/features/shared/components/nav-element";

type MocksSectionKey = "tests" | "custom" | "history";

interface MocksNavProps {
  /** Which section label is currently selected. */
  active: MocksSectionKey;
}

const MOCKS_SECTIONS: {
  key: MocksSectionKey;
  label: string;
  href: string;
}[] = [
  { key: "tests", label: "Tests", href: "/mocks/tests" },
  { key: "custom", label: "Custom", href: "/mocks/custom" },
  { key: "history", label: "My History", href: "/mocks/history" },
];

/**
 * MocksNav — section navigation shared by the mock-test pages.
 *
 * Built on the shared NavElement pattern (plain bold labels, green
 * underline for the selected section). An icon-only refresh sits at the far
 * right of the same row — it re-runs the server pass and signals the
 * mounted view (`mocks:refresh` event) to re-fetch its data in place.
 */
export function MocksNav({ active }: MocksNavProps) {
  const router = useRouter();

  const handleRefresh = () => {
    router.refresh();
    window.dispatchEvent(new Event("mocks:refresh"));
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <NavElement
        items={MOCKS_SECTIONS}
        active={active}
        ariaLabel="Mock test sections"
      />

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

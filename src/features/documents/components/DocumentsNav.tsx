"use client";

import {
  NavElement,
  type NavElementItem,
} from "@/features/shared/components/nav-element";

const DOCUMENTS_SECTIONS: NavElementItem[] = [
  { key: "documents", label: "Yours", href: "/documents" },
];

/**
 * DocumentsNav — page-level mini navbar for the documents view, built on
 * the shared NavElement pattern (plain bold label with the active green
 * underline; a single one-word section, since the whole page is one
 * section — navigation is still a real Link).
 */
export function DocumentsNav() {
  return (
    <div className="flex items-center justify-between gap-3">
      <NavElement
        items={DOCUMENTS_SECTIONS}
        active="documents"
        ariaLabel="Document sections"
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  NavElement,
  type NavElementItem,
} from "@/features/shared/components/nav-element";

import { createDocumentAction } from "../actions/create-document";
import { DocumentForm } from "./DocumentForm";

const DOCUMENTS_SECTIONS: NavElementItem[] = [
  { key: "documents", label: "Yours", href: "/documents" },
];

/**
 * DocumentsNav — page-level mini navbar for the documents view, built on
 * the shared NavElement pattern (plain bold label with the active green
 * underline; a single one-word section, since the whole page is one
 * section — navigation is still a real Link).
 *
 * Right side of the row: the list refresh icon (re-runs the server pass and
 * signals the mounted list via the `documents:refresh` event) and the
 * Create button which opens the create-document popup form.
 */
export function DocumentsNav() {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleRefresh = () => {
    router.refresh();
    window.dispatchEvent(new Event("documents:refresh"));
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <NavElement
        items={DOCUMENTS_SECTIONS}
        active="documents"
        ariaLabel="Document sections"
      />

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleRefresh}
          aria-label="Refresh documents"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <RotateCw className="size-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          <span>Create</span>
        </Button>
      </div>

      {/* The create/resume popup form — state is owned here so the nav
          button and the resume flow (card Resume button → DocumentForm's
          hydration effect → onOpenChange(true)) control the same popup. */}
      <DocumentForm
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSumbitAction={createDocumentAction}
      />
    </div>
  );
}

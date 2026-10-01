"use client";

import Link from "next/link";
import { PlusCircle, Database, HelpCircle, Sparkles } from "lucide-react";
import { QuestionForm } from "../../components/QuestionForm";
import { Badge } from "@/components/ui/badge";

export function QuestionsAdminView() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-muted text-brand">
              <HelpCircle className="size-4" />
            </span>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Question Authoring &amp; Catalog
            </h2>
            <Badge
              variant="outline"
              className="border-brand/30 bg-brand-muted text-[10px] font-semibold tracking-wide text-brand uppercase"
            >
              Admin Control
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Author new questions with rich LaTeX and options, or inspect database records.
          </p>
        </div>

        <div className="relative z-10 flex shrink-0 items-center gap-2">
          <Link
            href="/admin/questions/test"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-2xs transition-colors hover:bg-muted/80"
          >
            <Database className="size-3.5 text-muted-foreground" />
            <span>Inspect Database Questions</span>
          </Link>
        </div>
      </div>

      {/* Main Authoring Form */}
      <div className="space-y-4">
        <QuestionForm />
      </div>
    </div>
  );
}

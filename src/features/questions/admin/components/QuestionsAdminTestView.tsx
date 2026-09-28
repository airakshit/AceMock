"use client";

import Link from "next/link";
import { ArrowLeft, Database, PlusCircle } from "lucide-react";
import { QuestionsTestView } from "../../components/QuestionsTestView";
import { Badge } from "@/components/ui/badge";

export function QuestionsAdminTestView() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Database className="size-4" />
            </span>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Questions Database Inspector
            </h2>
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary text-[10px] font-semibold tracking-wide uppercase">
              Admin Query
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Filter, inspect, and verify questions stored in the database ingested via OCR or manual authoring.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/admin/questions"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/80 shadow-2xs"
          >
            <ArrowLeft className="size-3.5 text-muted-foreground" />
            <span>Create New Question</span>
          </Link>
        </div>
      </div>

      <QuestionsTestView />
    </div>
  );
}

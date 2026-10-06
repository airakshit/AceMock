import Link from "next/link";
import { Database, Flag } from "lucide-react";

import { QuestionReportsView } from "@/features/questions/admin";
import { PageHeader } from "@/components/patterns/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Question Reports | ePeX",
  description:
    "Review questions reported by students, filtered by report type and date.",
};

export default function AdminQuestionReportsPage() {
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <PageHeader
        eyebrow="Moderation"
        title="Reported Questions"
        description="Triage student reports, then fix the question in the bank."
        className="mx-auto w-full max-w-4xl"
        action={
          <Link
            href="/admin/questions"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "gap-1.5 text-xs",
            )}
          >
            <Database className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Open question bank</span>
            <span className="sm:hidden">Question bank</span>
          </Link>
        }
      />

      <div className="mx-auto flex w-full max-w-4xl items-center gap-2 text-xs text-muted-foreground">
        <Flag className="size-3.5 shrink-0 text-danger" aria-hidden="true" />
        <p>
          Each row is one question with every matching report rolled up onto
          it — the answer and solution are always revealed so the report can
          be verified in place.
        </p>
      </div>

      <QuestionReportsView />
    </div>
  );
}

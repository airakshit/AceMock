import Link from "next/link";
import { Suspense } from "react";
import { PlusCircle } from "lucide-react";
import { QuestionsAdminTestView } from "@/features/questions/admin";
import { AppHeader } from "@/components/layouts/components/AppHeader";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Admin Questions Inspector | AceMock",
  description:
    "Administrative inspection page to query and test questions directly from the database.",
};

export default function AdminQuestionsTestPage() {
  return (
    <>
      <AppHeader
        title="Questions Database Inspector"
        description="Live testing view for questions saved in the database via the OCR and ingestion pipeline."
        actions={
          <Link
            href="/admin/questions"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "gap-1.5 text-xs",
            )}
          >
            <PlusCircle className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Create New Question</span>
            <span className="sm:hidden">New Question</span>
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <Suspense
          fallback={
            <div
              role="status"
              aria-label="Loading questions database inspector"
              className="mx-auto max-w-6xl animate-pulse space-y-4 p-8"
            >
              <div className="h-8 w-2/3 rounded-lg bg-muted" />
              <div className="h-4 w-1/3 rounded bg-muted" />
              <div className="h-24 rounded-xl bg-muted/60" />
              <div className="h-24 rounded-xl bg-muted/60" />
              <span className="sr-only">Loading questions database inspector...</span>
            </div>
          }
        >
          <QuestionsAdminTestView />
        </Suspense>
      </div>
    </>
  );
}

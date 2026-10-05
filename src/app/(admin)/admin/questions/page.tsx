import Link from "next/link";
import { Database } from "lucide-react";
import { QuestionsAdminView } from "@/features/questions/admin";
import { PageHeader } from "@/components/patterns/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Admin Questions | AceMock",
  description: "Create and manage question bank with administrative controls.",
};

export default function AdminQuestionsPage() {
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <PageHeader
        title="Questions Management"
        description="Author questions with LaTeX, options, hints, and explanations."
        className="mx-auto w-full max-w-7xl"
        action={
          <Link
            href="/admin/questions/test"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "gap-1.5 text-xs",
            )}
          >
            <Database className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Inspect Database</span>
            <span className="sm:hidden">Inspect</span>
          </Link>
        }
      />
      <QuestionsAdminView />
    </div>
  );
}

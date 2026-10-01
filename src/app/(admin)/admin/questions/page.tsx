import Link from "next/link";
import { Database } from "lucide-react";
import { QuestionsAdminView } from "@/features/questions/admin";
import { AppHeader } from "@/components/layouts/components/AppHeader";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Admin Questions | AceMock",
  description: "Create and manage question bank with administrative controls.",
};

export default function AdminQuestionsPage() {
  return (
    <>
      <AppHeader
        title="Questions Management"
        description="Author questions with rich LaTeX, options, hints, and explanations."
        actions={
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
      <div className="flex-1 p-4 md:p-6">
        <QuestionsAdminView />
      </div>
    </>
  );
}

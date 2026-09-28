import { Suspense } from "react";
import { QuestionsAdminTestView } from "@/features/questions/admin";
import { AppHeader } from "@/components/layouts/components/AppHeader";

export const metadata = {
  title: "Admin Questions Inspector | AceMock",
  description: "Administrative inspection page to query and test questions directly from the database.",
};

export default function AdminQuestionsTestPage() {
  return (
    <>
      <AppHeader
        title="Questions Database Inspector"
        description="Live testing view for questions saved in the database via the OCR and ingestion pipeline."
      />
      <div className="flex-1 p-4 md:p-6 overflow-y-auto">
        <Suspense
          fallback={
            <div className="max-w-6xl mx-auto p-8 text-center text-sm text-muted-foreground animate-pulse">
              Loading questions database inspector...
            </div>
          }
        >
          <QuestionsAdminTestView />
        </Suspense>
      </div>
    </>
  );
}

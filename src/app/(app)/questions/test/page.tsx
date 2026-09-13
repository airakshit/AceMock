import { QuestionsTestView } from "@/features/questions/components/QuestionsTestView";
import { AppHeader } from "@/components/layouts/components/AppHeader";

export const metadata = {
  title: "Questions Test View | AceMock",
  description: "Test page to load and inspect questions directly from the backend database.",
};

export default function QuestionsTestPage() {
  return (
    <>
      <AppHeader
        title="Questions Database Test"
        description="Live testing view for questions saved in the database via the OCR and ingestion pipeline."
      />
      <div className="flex-1 p-4 md:p-6 overflow-y-auto">
        <QuestionsTestView />
      </div>
    </>
  );
}

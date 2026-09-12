import { QuestionsView } from "@/features/questions/components/QuestionsView";
import { AppHeader } from "@/components/layouts/components/AppHeader";

export default function QuestionsPage() {
  return (
    <>
      <AppHeader
        title="Questions"
        description="Create and manage your question bank by subject, section, and chapter."
      />
      <div className="flex-1 p-4 md:p-6">
        <QuestionsView />
      </div>
    </>
  );
}

import { QuestionsAdminView } from "@/features/questions/admin";
import { AppHeader } from "@/components/layouts/components/AppHeader";

export const metadata = {
  title: "Admin Questions | AceMock",
  description: "Create and manage question bank with administrative controls.",
};

export default function AdminQuestionsPage() {
  return (
    <>
      <AppHeader
        title="Questions Management"
        description="Create and manage your question bank by subject, section, and chapter."
      />
      <div className="flex-1 p-4 md:p-6">
        <QuestionsAdminView />
      </div>
    </>
  );
}

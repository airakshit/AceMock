import { QuestionCardPreview } from "@/features/questions/components/question-card/QuestionCardPreview";
import { AppHeader } from "@/components/layouts/components/AppHeader";

export default function QuestionsPreviewPage() {
  return (
    <>
      <AppHeader
        title="Question Card Preview"
        description="Preview the QuestionCard component with mock data in exam and review modes."
      />
      <div className="flex-1 p-4 md:p-6">
        <QuestionCardPreview />
      </div>
    </>
  );
}

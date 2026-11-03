import { PageHeader } from "@/components/patterns/page-header";
import { QuestionRenderingPlayground } from "@/features/questions/components/rendering-playground/QuestionRenderingPlayground";

export const metadata = {
  title: "Question Rendering Playground | ePeX",
  description:
    "Preview question text, OCR output, and JSON with the shared question renderer.",
};

export default function QuestionRenderingPage() {
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <PageHeader
        title="Question Rendering Playground"
        description="Paste OCR output or question JSON to test how it renders in a mock test."
      />
      <QuestionRenderingPlayground />
    </div>
  );
}

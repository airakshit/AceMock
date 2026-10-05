import { PageHeader } from "@/components/patterns/page-header";
import { CustomMockTestForm } from "@/features/mocks/components/CustomMockTestForm";
import { MocksNav } from "@/features/mocks/components/MocksNav";

export const metadata = {
  title: "Custom Tests | AceMock",
  description: "Build a mock test from your own uploaded documents.",
};

export default function MocksCustomPage() {
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <PageHeader
        title="Custom Tests"
        description="Assemble a practice test from documents you have uploaded."
      />
      <MocksNav active="custom" />
      <CustomMockTestForm />
    </div>
  );
}

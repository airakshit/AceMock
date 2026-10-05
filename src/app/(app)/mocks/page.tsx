import { PageHeader } from "@/components/patterns/page-header";
import { MocksView } from "@/features/mocks/components/MocksView";
import { mockTestsService } from "@/features/mocks/service";

export const metadata = {
  title: "Mock Tests | AceMock",
  description: "Full-length and practice examinations.",
};

export default async function MocksPage() {
  const initialTests = await mockTestsService.getAllMockTests();

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <PageHeader
        title="Mock Tests"
        description={
          initialTests.length > 0
            ? `${initialTests.length} tests · full-length and chapter practice`
            : "Full-length and chapter practice tests"
        }
      />
      <MocksView initialTests={initialTests} />
    </div>
  );
}

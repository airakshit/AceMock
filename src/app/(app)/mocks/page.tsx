import { MocksView } from "@/features/mocks/components/MocksView";
import { AppHeader } from "@/components/layouts/components/AppHeader";
import { mockTestsService } from "@/features/mocks/service";

export const metadata = {
  title: "Mock Tests | AceMock",
  description: "Full-length and practice examinations.",
};

export default async function MocksPage() {
  const initialTests = await mockTestsService.getAllMockTests();

  return (
    <>
      <AppHeader
        title="Mock Tests"
        description="Full-length and practice examinations."
      />
      <div className="flex-1 p-4 md:p-6">
        <MocksView initialTests={initialTests} />
      </div>
    </>
  );
}

import { MocksView } from "@/features/mocks/components/MocksView";
import { AppHeader } from "@/components/layouts/components/AppHeader";

export default function MocksPage() {
  return (
    <>
      <AppHeader
        title="Mock Tests"
        description="Full-length and subject-wise practice tests."
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <MocksView />
      </div>
    </>
  );
}

import { AppHeader } from "@/components/layouts/components/AppHeader";
import { MockTestsAdminView } from "@/features/mocks/admin";

export const metadata = {
  title: "Admin Mock Tests | AceMock",
  description: "Assemble and configure mock tests with administrative controls.",
};

export default function AdminMockTestsPage() {
  return (
    <>
      <AppHeader
        title="Mock Tests Management"
        description="Assemble, schedule, and configure mock tests from document question banks."
      />
      <div className="flex-1 p-4 md:p-6">
        <MockTestsAdminView />
      </div>
    </>
  );
}

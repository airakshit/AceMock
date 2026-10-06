import { PageHeader } from "@/components/patterns/page-header";
import { MockTestsAdminView } from "@/features/mocks/admin";

export const metadata = {
  title: "Admin Mock Tests | ePeX",
  description: "Assemble and configure mock tests with administrative controls.",
};

export default function AdminMockTestsPage() {
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <PageHeader
        title="Mock Tests Management"
        description="Assemble and configure mock tests from document question banks."
      />
      <MockTestsAdminView />
    </div>
  );
}

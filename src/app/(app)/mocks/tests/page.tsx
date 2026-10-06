import { PageHeader } from "@/components/patterns/page-header";
import { MocksNav } from "@/features/mocks/components/MocksNav";
import { MockTestsSearchList } from "@/features/mocks/components/MockTestsSearchList";
import { searchApplicationTestsAction } from "@/features/mocks/actions/search-application-tests";

export const metadata = {
  title: "Mock Tests | ePeX",
  description: "Full-length and practice examinations.",
};

export default function MocksTestsPage() {
  // No server wait here on purpose: the shell (header, labels, filter bar,
  // skeleton) renders instantly on navigation and the first page of results
  // loads in the background through the same search action below.
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <PageHeader
        title="Mock Tests"
        description="Full-length and chapter practice tests."
      />
      <MocksNav active="tests" />
      <MockTestsSearchList
        search={searchApplicationTestsAction}
        emptyTitle="No mock tests available yet"
        emptyDescription="Mock examinations will appear here once published."
      />
    </div>
  );
}

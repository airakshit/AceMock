import { PageHeader } from "@/components/patterns/page-header";
import { MocksNav } from "@/features/mocks/components/MocksNav";
import { MockTestsSearchList } from "@/features/mocks/components/MockTestsSearchList";
import { searchApplicationTestsAction } from "@/features/mocks/actions/search-application-tests";
import { mockTestsService } from "@/features/mocks/service";

export const metadata = {
  title: "Mock Tests | AceMock",
  description: "Full-length and practice examinations.",
};

export default async function MocksTestsPage() {
  // Only the tests published by the application (`byAdmin = true`) — the
  // flag lives in the service, so no caller of this page can widen it. The
  // first page is rendered here purely so the list hydrates without a flash;
  // every later page comes from the client-side keyset search.
  const initial = await mockTestsService.searchApplicationTests();

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <PageHeader
        title="Mock Tests"
        description="Full-length and chapter practice tests."
      />
      <MocksNav active="tests" />
      <MockTestsSearchList
        search={searchApplicationTestsAction}
        initial={initial}
        emptyTitle="No mock tests available yet"
        emptyDescription="Mock examinations will appear here once published."
      />
    </div>
  );
}

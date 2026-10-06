import { PageHeader } from "@/components/patterns/page-header";
// BISECT-2: form import removed to test graph involvement
// import { CustomMockTestForm } from "@/features/mocks/components/CustomMockTestForm";
import { MocksNav } from "@/features/mocks/components/MocksNav";
import { MockTestsSearchList } from "@/features/mocks/components/MockTestsSearchList";
import { searchMyCustomTestsAction } from "@/features/mocks/actions/search-my-custom-tests";

export const metadata = {
  title: "Custom Tests | AceMock",
  description: "Build a mock test from your own uploaded documents.",
};

export default async function MocksCustomPage() {
  // The action pins `userId` to the session, so this page can only ever
  // render tests the visitor authored — never another user's, and never the
  // application's published tests. `initial` is only a hydration seed; the
  // client search takes over from the first filter change.
  const result = await searchMyCustomTestsAction();
  const initial = result.success ? result.data : null;

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <PageHeader
        title="Custom Tests"
        description="Assemble a practice test from documents you have uploaded."
      />
      <MocksNav active="custom" />
      {/* BISECT-1: form usage stubbed (import kept) to isolate render vs graph */}
      {/* <CustomMockTestForm /> */}

      <section className="space-y-4 pt-1">
        <h2 className="font-heading text-lg font-bold tracking-tight sm:text-xl">
          Your tests
        </h2>
        <MockTestsSearchList
          search={searchMyCustomTestsAction}
          initial={initial}
          emptyTitle="No custom tests yet"
          emptyDescription="Build your first custom test above from the documents you have uploaded."
        />
      </section>
    </div>
  );
}

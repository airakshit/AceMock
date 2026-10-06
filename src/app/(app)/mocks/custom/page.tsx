import { PageHeader } from "@/components/patterns/page-header";
import { CustomMockTestForm } from "@/features/mocks/components/CustomMockTestForm";
import { MocksNav } from "@/features/mocks/components/MocksNav";
import { MockTestsSearchList } from "@/features/mocks/components/MockTestsSearchList";
import { searchMyCustomTestsAction } from "@/features/mocks/actions/search-my-custom-tests";

export const metadata = {
  title: "Custom Tests | ePeX",
  description: "Build a mock test from your own uploaded documents.",
};

export default function MocksCustomPage() {
  // No server wait here on purpose: the shell (header, labels, form,
  // skeleton) renders instantly on navigation and the visitor's tests load
  // in the background. The action pins `userId` to the session, so the list
  // can only ever show tests the visitor authored — and for the same reason
  // it must never be awaited here: touching the session during prerender
  // opts this route out of static rendering.
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <PageHeader
        title="Custom Tests"
        description="Assemble a practice test from documents you have uploaded."
      />
      <MocksNav active="custom" />
      <CustomMockTestForm />

      <section className="space-y-4 pt-1">
        <h2 className="font-heading text-lg font-bold tracking-tight sm:text-xl">
          Your tests
        </h2>
        <MockTestsSearchList
          search={searchMyCustomTestsAction}
          emptyTitle="No custom tests yet"
          emptyDescription="Build your first custom test above from the documents you have uploaded."
        />
      </section>
    </div>
  );
}

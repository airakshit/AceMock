import { PageHeader } from "@/components/patterns/page-header";
import { MocksNav } from "@/features/mocks/components/MocksNav";
import { AttemptHistoryView } from "@/features/mocks/components/attempt-history/AttemptHistoryView";

export const metadata = {
  title: "My History | AceMock",
  description: "Review your past mock test attempts and score breakdowns.",
};

export default function AttemptHistoryPage() {
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <PageHeader
        title="My History"
        description="Scores and answer breakdowns for every attempt."
      />
      <MocksNav active="history" />
      <AttemptHistoryView />
    </div>
  );
}

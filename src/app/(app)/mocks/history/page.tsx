import { AppHeader } from "@/components/layouts/components/AppHeader";
import { AttemptHistoryView } from "@/features/mocks/components/attempt-history/AttemptHistoryView";

export const metadata = {
  title: "My History | AceMock",
  description: "Review your past mock test attempts and score breakdowns.",
};

export default function AttemptHistoryPage() {
  return (
    <>
      <AppHeader
        title="My History"
        description="Your past mock test attempts, scores and answer breakdowns."
      />
      <div className="flex-1 p-4 md:p-6">
        <AttemptHistoryView />
      </div>
    </>
  );
}

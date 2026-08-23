import { MetricsSection } from "@/features/dashboard/components/MetricsSection";
import { PopularMockTestsSection } from "@/features/dashboard/components/PopularMockTestsSection";
import { dashboardMockDataWithHistory } from "@/features/dashboard/mockData";

export function DashboardView() {
  const data = dashboardMockDataWithHistory;

  return (
    <div className="space-y-8">
      <MetricsSection data={data.metrics} />
      <PopularMockTestsSection tests={data.popularMockTests} />
    </div>
  );
}

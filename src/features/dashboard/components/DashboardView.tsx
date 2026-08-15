import { MetricsSection } from "@/features/dashboard/components/MetricsSection";
import { PopularMockTestsSection } from "@/features/dashboard/components/PopularMockTestsSection";
import { dashboardMockData } from "@/features/dashboard/mockData";

export function DashboardView() {
    const data = dashboardMockData;

    return (
        <div className="space-y-8">
            <MetricsSection data={data.metrics} />
            <PopularMockTestsSection tests={data.popularMockTests} />
        </div>
    );
}

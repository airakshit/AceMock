import { DashboardView } from "@/features/dashboard/components/DashboardView";
import { AppHeader } from "@/features/shell/components/AppHeader";

export default function DashboardPage() {
    return (
        <>
            <AppHeader
                title="Dashboard"
                description="Track your progress and jump into popular mock tests."
            />
            <div className="flex-1 overflow-auto p-4 md:p-6">
                <DashboardView />
            </div>
        </>
    );
}

import { DashboardView } from "@/features/dashboard/components/DashboardView";

export default function DashboardPage() {
  // No PageHeader here: DashboardHero is the page's editorial intro.
  // pt-14 clears the floating mobile menu trigger.
  return (
    <div className="flex-1 p-4 pt-14 md:p-6 md:pt-6">
      <DashboardView />
    </div>
  );
}

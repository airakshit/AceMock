import { Award, BarChart2, CheckCircle2, Target, TrendingUp } from "lucide-react";
import { MetricCard } from "@/components/patterns/metric-card";
import { EmptyState } from "@/components/patterns/empty-state";
import { SectionHeader } from "@/components/patterns/page-header";
import type { DashboardMetrics } from "@/features/dashboard/types";

interface MetricsSectionProps {
  data: DashboardMetrics;
}

function getMetricIcon(id: string) {
  switch (id) {
    case "tests-taken":
      return <CheckCircle2 className="size-4" />;
    case "average-score":
      return <Target className="size-4" />;
    case "best-rank":
      return <Award className="size-4" />;
    default:
      return <TrendingUp className="size-4" />;
  }
}

export function MetricsSection({ data }: MetricsSectionProps) {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Performance Overview"
        description="A real-time snapshot of your preparation, test attempts, and scores."
      />

      {!data.hasAttemptedTests || data.metrics.length === 0 ? (
        <EmptyState
          icon={BarChart2}
          title="No mock tests completed yet"
          description="Complete your first mock test below to begin tracking your score analytics, percentile rank, and accuracy."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.metrics.map((metric) => (
            <MetricCard
              key={metric.id}
              label={metric.label}
              value={metric.value}
              hint={metric.hint}
              accent={metric.accent ?? "default"}
              icon={getMetricIcon(metric.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

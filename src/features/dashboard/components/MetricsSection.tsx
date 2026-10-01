import { Award, BarChart2, CheckCircle2, Target, TrendingUp } from "lucide-react";
import { MetricCard } from "@/components/patterns/metric-card";
import { SectionHeader } from "@/components/patterns/page-header";
import { typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 px-6 py-12 text-center">
          <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-brand-muted text-brand">
            <BarChart2 className="size-5" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            No mock tests completed yet
          </p>
          <p className={cn(typography.caption, "mt-1 max-w-sm text-muted-foreground")}>
            Complete your first mock test below to begin tracking your score analytics, percentile rank, and accuracy.
          </p>
        </div>
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

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
      return <CheckCircle2 className="size-3.5 text-muted-foreground" />;
    case "average-score":
      return <Target className="size-3.5 text-muted-foreground" />;
    case "best-rank":
      return <Award className="size-3.5 text-muted-foreground" />;
    default:
      return <TrendingUp className="size-3.5 text-muted-foreground" />;
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
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 px-6 py-9 text-center">
          <div className="flex size-10 items-center justify-center rounded-md bg-muted/60 text-muted-foreground mb-2.5">
            <BarChart2 className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            No mock tests completed yet
          </p>
          <p className={cn(typography.caption, "mt-1 max-w-sm text-muted-foreground")}>
            Complete your first mock test below to begin tracking your score analytics, percentile rank, and accuracy.
          </p>
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {data.metrics.map((metric) => (
            <MetricCard
              key={metric.id}
              label={metric.label}
              value={metric.value}
              hint={metric.hint}
              accent={metric.accent}
              icon={getMetricIcon(metric.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

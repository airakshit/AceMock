import { MetricCard } from "@/components/patterns/metric-card";
import { SectionHeader } from "@/components/patterns/page-header";
import { typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import type { DashboardMetrics } from "@/features/dashboard/types";

interface MetricsSectionProps {
    data: DashboardMetrics;
}

export function MetricsSection({ data }: MetricsSectionProps) {
    return (
        <section className="space-y-4">
            <SectionHeader
                title="Your progress"
                description="A quick snapshot of your mock test activity."
            />

            {!data.hasAttemptedTests ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                    <p className={typography.body}>
                        Haven&apos;t given a test? Try one below
                    </p>
                    <p className={cn(typography.caption, "mt-1.5")}>
                        Your stats will appear here after your first attempt.
                    </p>
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {data.metrics.map((metric) => (
                        <MetricCard
                            key={metric.id}
                            label={metric.label}
                            value={metric.value}
                            hint={metric.hint}
                            accent={metric.accent}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

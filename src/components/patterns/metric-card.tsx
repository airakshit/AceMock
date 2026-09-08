import { typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";

export type MetricAccent = "default" | "brand" | "success" | "info" | "warning";

interface MetricCardProps {
  label: string;
  value: string | number;
  hint?: string;
  accent?: MetricAccent;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  className?: string;
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
  trend,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col justify-between rounded-lg border border-border bg-card p-4.5 shadow-2xs transition-colors hover:border-foreground/20",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {icon ? (
          <div className="flex size-7 items-center justify-center rounded-md bg-muted/60 text-muted-foreground border border-border/60">
            {icon}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-baseline gap-2.5">
        <span className={cn(typography.metric, "text-2xl sm:text-3xl font-bold tracking-tight text-foreground")}>
          {value}
        </span>

        {trend ? (
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
            )}
          >
            {trend.isPositive ? "↑" : "↓"} {trend.value}
          </span>
        ) : null}
      </div>

      {hint ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

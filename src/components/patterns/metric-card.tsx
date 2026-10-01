import { colors, typography } from "@/lib/design-system";
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
  accent = "default",
  icon,
  trend,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
        className,
      )}
    >
      {/* Accent hairline */}
      <span
        className={cn(
          "absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent opacity-60",
          accent === "brand" && "text-brand",
          accent === "success" && "text-emerald-500",
          accent === "info" && "text-sky-500",
          accent === "warning" && "text-amber-500",
          accent === "default" && "opacity-0",
        )}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {label}
          </p>
          <div className="mt-2.5 flex items-baseline gap-2.5">
            <span
              className={cn(
                typography.metric,
                "text-2xl leading-none font-bold tracking-tight text-foreground tabular-nums sm:text-3xl",
              )}
            >
              {value}
            </span>

            {trend ? (
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  trend.isPositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400",
                )}
              >
                {trend.isPositive ? "↑" : "↓"} {trend.value}
              </span>
            ) : null}
          </div>
        </div>

        {icon ? (
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-transform duration-200 group-hover:scale-105",
              colors.metricAccent[accent],
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>

      {hint ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

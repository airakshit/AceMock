import { cn } from "@/lib/utils";
import { typography } from "@/lib/design-system";

export type MetricAccent = "default" | "success" | "info" | "warning";

interface MetricCardProps {
    label: string;
    value: string | number;
    hint?: string;
    accent?: MetricAccent;
    className?: string;
}

const accentStyles: Record<MetricAccent, string> = {
    default: "bg-muted/60 text-foreground",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    info: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

export function MetricCard({
    label,
    value,
    hint,
    accent = "default",
    className,
}: MetricCardProps) {
    return (
        <div
            className={cn(
                "rounded-xl border border-border bg-card p-4 shadow-sm",
                className,
            )}
        >
            <p className={typography.label}>{label}</p>
            <p
                className={cn(
                    typography.metric,
                    "mt-3 inline-flex rounded-lg px-2.5 py-1",
                    accentStyles[accent],
                )}
            >
                {value}
            </p>
            {hint ? (
                <p className={cn(typography.caption, "mt-2")}>{hint}</p>
            ) : null}
        </div>
    );
}

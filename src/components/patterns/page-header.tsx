import { cn } from "@/lib/utils";
import { typography } from "@/lib/design-system";

interface PageHeaderProps {
    title: string;
    description?: string;
    className?: string;
}

export function PageHeader({ title, description, className }: PageHeaderProps) {
    return (
        <div className={cn("space-y-1.5", className)}>
            <h2 className={typography.display}>{title}</h2>
            {description ? (
                <p className={typography.sectionSubtitle}>{description}</p>
            ) : null}
        </div>
    );
}

interface SectionHeaderProps {
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}

export function SectionHeader({
    title,
    description,
    action,
    className,
}: SectionHeaderProps) {
    return (
        <div
            className={cn(
                "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
                className,
            )}
        >
            <div className="space-y-1">
                <h3 className={typography.sectionTitle}>{title}</h3>
                {description ? (
                    <p className={typography.sectionSubtitle}>{description}</p>
                ) : null}
            </div>
            {action}
        </div>
    );
}

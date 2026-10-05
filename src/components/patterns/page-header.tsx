import { typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 pt-10 pb-1 sm:flex-row sm:items-center sm:justify-between md:pt-0",
        className,
      )}
    >
      <div className="space-y-0.5">
        {eyebrow ? (
          <p className={typography.eyebrow}>{eyebrow}</p>
        ) : null}
        <h1 className={cn(typography.pageTitle, "text-xl md:text-2xl font-semibold tracking-tight")}>
          {title}
        </h1>
        {description ? (
          <p className={cn(typography.pageSubtitle, "text-xs md:text-sm text-muted-foreground")}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2 pt-1 sm:pt-0">{action}</div> : null}
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
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="space-y-0.5">
        <h3 className={cn(typography.sectionTitle, "text-base md:text-lg font-semibold tracking-tight")}>
          {title}
        </h3>
        {description ? (
          <p className={cn(typography.sectionSubtitle, "text-xs text-muted-foreground")}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2 pt-1 sm:pt-0">{action}</div> : null}
    </div>
  );
}

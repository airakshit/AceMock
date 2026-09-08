import { ArrowRight, Clock3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { colors, type DifficultyLevel, typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";

export interface MockTestCardData {
  id: string;
  title: string;
  durationMinutes: number;
  totalQuestions: number;
  subject?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  isPopular?: boolean;
}

interface MockTestCardProps {
  test: MockTestCardData;
  actionLabel?: string;
  onAction?: (testId: string) => void;
  className?: string;
}

export function MockTestCard({
  test,
  actionLabel = "Start Test",
  onAction,
  className,
}: MockTestCardProps) {
  const diffConfig = test.difficulty
    ? colors.difficulty[test.difficulty as DifficultyLevel]
    : null;

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col justify-between rounded-lg border border-border bg-card p-4.5 shadow-2xs hover:border-foreground/20 hover:shadow-xs transition-all duration-150",
        className,
      )}
    >
      <div>
        {/* Top meta row: Subject and Popular tag */}
        <div className="flex items-center justify-between gap-2 pb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {test.subject ? (
              <span className="inline-flex items-center rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {test.subject}
              </span>
            ) : null}

            {diffConfig ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium",
                  diffConfig.badge,
                )}
              >
                <span className={cn("size-1.5 rounded-full", diffConfig.dot)} />
                {diffConfig.label}
              </span>
            ) : null}
          </div>

          {test.isPopular ? (
            <span className="rounded border border-border/80 bg-muted px-1.5 py-0.2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Popular
            </span>
          ) : null}
        </div>

        {/* Title */}
        <h4 className={cn(typography.cardTitle, "line-clamp-2 min-h-10 text-sm font-semibold tracking-tight text-foreground group-hover:text-foreground transition-colors")}>
          {test.title}
        </h4>

        {/* Specs: Duration and Question count */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3.5 text-muted-foreground/70" />
            <span className="font-medium text-foreground/80">{test.durationMinutes}</span> mins
          </span>

          <span className="inline-flex items-center gap-1">
            <FileText className="size-3.5 text-muted-foreground/70" />
            <span className="font-medium text-foreground/80">{test.totalQuestions}</span> questions
          </span>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="mt-4 pt-3 border-t border-border/50">
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-between text-xs font-medium hover:bg-foreground hover:text-background transition-colors"
          onClick={() => onAction?.(test.id)}
        >
          <span>{actionLabel}</span>
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>
    </article>
  );
}

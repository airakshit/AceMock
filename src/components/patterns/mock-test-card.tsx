import { ArrowRight, Clock3, FileText, Award, History, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { colors, type DifficultyLevel, typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";

export interface MockTestCardData {
  id: string;
  title: string;
  durationMinutes: number;
  totalQuestions: number;
  totalMarks?: number;
  negativePercentage?: number;
  subject?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  isPopular?: boolean;
}

interface MockTestCardProps {
  test: MockTestCardData;
  actionLabel?: string;
  onAction?: (testId: string) => void;
  /**
   * Shows a small history button in the card's top-right corner which opens
   * this test's attempt history. Omit it to hide the button (dashboard).
   */
  onShowHistory?: (testId: string) => void;
  className?: string;
}

export function MockTestCard({
  test,
  actionLabel = "Start Test",
  onAction,
  onShowHistory,
  className,
}: MockTestCardProps) {
  const diffConfig = test.difficulty
    ? colors.difficulty[test.difficulty as DifficultyLevel]
    : null;

  const specs = [
    { icon: Clock3, value: test.durationMinutes, label: "mins" },
    { icon: FileText, value: test.totalQuestions, label: "questions" },
    ...(test.totalMarks !== undefined
      ? [{ icon: Award, value: test.totalMarks, label: "marks" }]
      : []),
    ...(test.negativePercentage !== undefined && test.negativePercentage > 0
      ? [{ icon: Percent, value: `-${test.negativePercentage}%`, label: "penalty" }]
      : []),
  ];

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-card-hover",
        className,
      )}
    >
      {/* Hover glow */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-brand/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden="true"
      />

      <div className="relative">
        {/* Top meta row: Subject, difficulty, popular tag */}
        <div className="flex items-center justify-between gap-2 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {test.subject ? (
              <span className="inline-flex items-center rounded-md border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {test.subject}
              </span>
            ) : null}

            {diffConfig ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                  diffConfig.badge,
                )}
              >
                <span className={cn("size-1.5 rounded-full", diffConfig.dot)} />
                {diffConfig.label}
              </span>
            ) : null}
          </div>

          {test.isPopular ? (
            <span className="shrink-0 rounded-md bg-brand-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-brand uppercase">
              Popular
            </span>
          ) : null}
        </div>

        {/* Title + per-test attempt history trigger (same row) */}
        <div className="flex items-start gap-2">
          <h4
            className={cn(
              typography.cardTitle,
              "line-clamp-2 min-h-10 min-w-0 flex-1 text-[15px] font-semibold tracking-tight text-foreground transition-colors group-hover:text-brand",
            )}
          >
            {test.title}
          </h4>

          {onShowHistory ? (
            <button
              type="button"
              onClick={() => onShowHistory(test.id)}
              aria-label={`View attempt history for ${test.title}`}
              title="Attempt history"
              className="-mt-1.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/50 text-muted-foreground transition-colors hover:border-brand/40 hover:bg-brand-muted hover:text-brand focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none sm:-mt-1 sm:size-7"
            >
              <History className="size-4 sm:size-3.5" />
            </button>
          ) : null}
        </div>

        {/* Specs */}
        <dl className="mt-4 grid grid-cols-2 gap-2">
          {specs.map((spec) => (
            <div
              key={spec.label}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1.5"
            >
              <spec.icon className="size-3.5 shrink-0 text-muted-foreground/70" />
              <div className="flex min-w-0 items-baseline gap-1">
                <dt className="sr-only">{spec.label}</dt>
                <dd className="text-xs font-semibold text-foreground tabular-nums">
                  {spec.value}
                </dd>
                <span className="truncate text-[11px] text-muted-foreground">
                  {spec.label}
                </span>
              </div>
            </div>
          ))}
        </dl>
      </div>

      {/* Footer CTA */}
      <div className="relative mt-4 border-t border-border/50 pt-3">
        <Button
          size="sm"
          variant="outline"
          className="h-9 w-full justify-between text-xs font-medium transition-colors group-hover:border-brand/40 group-hover:bg-brand group-hover:text-brand-foreground"
          onClick={() => onAction?.(test.id)}
        >
          <span>{actionLabel}</span>
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>
    </article>
  );
}

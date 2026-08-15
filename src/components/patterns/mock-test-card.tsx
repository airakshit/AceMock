import { Clock3, FileQuestion } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { typography } from "@/lib/design-system";
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
    className?: string;
}

export function MockTestCard({
    test,
    actionLabel = "Start",
    className,
}: MockTestCardProps) {
    return (
        <article
            className={cn(
                "flex h-full flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-foreground/20",
                className,
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                    {test.subject ? (
                        <Badge variant="secondary" className="text-xs">
                            {test.subject}
                        </Badge>
                    ) : null}
                    <h4 className="line-clamp-2 font-heading text-sm font-semibold leading-snug tracking-tight md:text-base">
                        {test.title}
                    </h4>
                </div>
                {test.isPopular ? (
                    <Badge className="shrink-0 bg-foreground text-background hover:bg-foreground/90">
                        Popular
                    </Badge>
                ) : null}
            </div>

            <div className={cn("mt-4 flex flex-wrap gap-3", typography.caption)}>
                <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="size-3.5" />
                    {test.durationMinutes} min
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <FileQuestion className="size-3.5" />
                    {test.totalQuestions} questions
                </span>
                {test.difficulty ? (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                        {test.difficulty}
                    </span>
                ) : null}
            </div>

            <div className="mt-auto pt-4">
                <Button className="w-full" size="sm">
                    {actionLabel}
                </Button>
            </div>
        </article>
    );
}

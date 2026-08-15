import { Clock3, FileQuestion, Layers3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { customMockData } from "@/features/custom/mockData";

export function CustomView() {
    const { subjects, recentDrafts } = customMockData;

    return (
        <div className="space-y-8">
            <section className="space-y-4">
                <h3 className={typography.sectionTitle}>Create a new test</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {subjects.map((subject) => (
                        <button
                            key={subject}
                            type="button"
                            className="rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-foreground/20 hover:bg-muted/40"
                        >
                            <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                                <Layers3 className="size-4" />
                            </div>
                            <p className="mt-3 font-heading text-sm font-semibold tracking-tight">
                                {subject}
                            </p>
                            <p className={cn(typography.caption, "mt-1")}>
                                Pick topics and question count
                            </p>
                        </button>
                    ))}
                </div>
                <Button>Create custom test</Button>
            </section>

            <section className="space-y-4">
                <h3 className={typography.sectionTitle}>Recent drafts</h3>
                {recentDrafts.length === 0 ? (
                    <div className={cn("rounded-xl border border-dashed border-border px-4 py-8 text-center", typography.bodyMuted)}>
                        No drafts yet. Start by choosing a subject above.
                    </div>
                ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                        {recentDrafts.map((draft) => (
                            <article
                                key={draft.id}
                                className="rounded-xl border border-border bg-card p-4 shadow-sm"
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">
                                        {draft.subject}
                                    </Badge>
                                    <Badge variant="outline">
                                        {draft.difficulty}
                                    </Badge>
                                </div>
                                <h4 className={cn(typography.sectionTitle, "mt-3 text-sm md:text-base")}>
                                    {draft.title}
                                </h4>
                                <div className={cn("mt-3 flex flex-wrap gap-3", typography.caption)}>
                                    <span className="inline-flex items-center gap-1.5">
                                        <FileQuestion className="size-3.5" />
                                        {draft.questionCount} questions
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <Clock3 className="size-3.5" />
                                        {draft.durationMinutes} min
                                    </span>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <Button size="sm">Continue</Button>
                                    <Button size="sm" variant="outline">
                                        Edit
                                    </Button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

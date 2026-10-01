import Link from "next/link";
import { ArrowRight, Sparkles, Upload } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * DashboardHero — a compact branded banner that anchors the dashboard and
 * surfaces the two primary actions (browse tests / upload material).
 */
export function DashboardHero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand/20 bg-brand-gradient-soft p-6 sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-40" />
      <div className="pointer-events-none absolute -top-20 right-0 size-64 rounded-full bg-brand/15 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-background/60 px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] text-brand uppercase backdrop-blur-sm">
            <Sparkles className="size-3" />
            Overview
          </span>
          <h2 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Ready for your next attempt?
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Pick up a full-length simulation or turn your study documents into a
            fresh, targeted practice set.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/mocks"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-9 gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90",
            )}
          >
            Browse mock tests
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/documents"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-9 gap-1.5 bg-background/70 backdrop-blur-sm",
            )}
          >
            <Upload className="size-4" />
            Upload material
          </Link>
        </div>
      </div>
    </section>
  );
}

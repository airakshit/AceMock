"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}

export function AppHeader({
  title,
  description,
  eyebrow,
  actions,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/80 bg-background/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="-ml-1 md:hidden" />
        <Separator orientation="vertical" className="mr-1 h-4 md:hidden" />
        <div className="min-w-0">
          {eyebrow ? (
            <p className={cn(typography.eyebrow, "mb-0.5 text-[10px]")}>
              {eyebrow}
            </p>
          ) : null}
          <h1
            data-page-title
            className={cn(
              typography.pageTitle,
              "truncate text-[15px] leading-tight font-semibold tracking-tight md:text-base",
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                typography.pageSubtitle,
                "hidden truncate text-xs font-normal text-muted-foreground sm:block",
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

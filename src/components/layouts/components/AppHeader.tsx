"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function AppHeader({ title, description, actions }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 md:px-6 backdrop-blur-sm">
      <div className="flex items-center gap-3 min-w-0">
        <SidebarTrigger className="-ml-1 md:hidden" />
        <Separator orientation="vertical" className="mr-1 h-4 md:hidden" />
        <div className="min-w-0 space-y-0.5">
          <h1 data-page-title className={cn(typography.pageTitle, "truncate text-base md:text-lg font-semibold tracking-tight")}>
            {title}
          </h1>
          {description ? (
            <p className={cn(typography.pageSubtitle, "truncate text-xs text-muted-foreground font-normal")}>
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {actions ? (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

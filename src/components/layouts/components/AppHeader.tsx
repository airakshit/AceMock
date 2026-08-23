"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  title: string;
  description?: string;
}

export function AppHeader({ title, description }: AppHeaderProps) {
  return (
    <header className="flex h-15 shrink-0 items-center gap-3 border-b border-border px-4 md:px-6">
      <SidebarTrigger className="-ml-1 md:hidden" />
      <Separator orientation="vertical" className="mr-1 h-4 md:hidden" />
      <div className="min-w-0 space-y-0.5">
        <h1 data-page-title className={cn(typography.pageTitle, "truncate")}>
          {title}
        </h1>
        {description ? (
          <p className={cn(typography.pageSubtitle, "truncate")}>
            {description}
          </p>
        ) : null}
      </div>
    </header>
  );
}

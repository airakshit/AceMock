"use client";

import { Laptop2, Moon, SunMedium } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import type { ThemePreference } from "@/lib/theme";

const themeOptions: {
  value: ThemePreference;
  label: string;
  Icon: typeof SunMedium;
}[] = [
  { value: "system", label: "System", Icon: Laptop2 },
  { value: "light", label: "Light", Icon: SunMedium },
  { value: "dark", label: "Dark", Icon: Moon },
];

export function ThemeToggle() {
  const { theme, setTheme, mounted } = useTheme();

  return (
    <div className="flex min-w-44 flex-col gap-2 rounded-2xl border border-border bg-muted/50 p-2">
      <span className="px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Theme
      </span>
      <div
        className="inline-flex h-9 w-full items-center gap-0.5 rounded-lg border border-border bg-background p-0.5"
        role="group"
        aria-label="Theme preference"
      >
        {themeOptions.map(({ value, Icon, label }) => {
          const isSelected = mounted && theme === value;

          return (
            <Button
              key={value}
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setTheme(value)}
              aria-label={`${label} theme`}
              aria-pressed={isSelected}
              className={cn(
                "h-7 flex-1 rounded-md text-muted-foreground",
                isSelected &&
                  "bg-foreground text-background hover:bg-foreground/90 hover:text-background",
              )}
            >
              <Icon className="size-3.5" />
            </Button>
          );
        })}
      </div>
    </div>
  );
}

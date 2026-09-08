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
  { value: "system", label: "Auto", Icon: Laptop2 },
  { value: "light", label: "Light", Icon: SunMedium },
  { value: "dark", label: "Dark", Icon: Moon },
];

export function ThemeToggle() {
  const { theme, setTheme, mounted } = useTheme();

  return (
    <div className="flex min-w-44 flex-col gap-2 rounded-xl border border-border/80 bg-card p-2.5 shadow-xs">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Theme
        </span>
      </div>
      <div
        className="inline-flex h-9 w-full items-center gap-1 rounded-lg border border-border/70 bg-muted/40 p-1"
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
              size="sm"
              onClick={() => setTheme(value)}
              aria-label={`${label} theme`}
              aria-pressed={isSelected}
              className={cn(
                "h-7 flex-1 gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-all duration-150",
                isSelected
                  ? "bg-card text-foreground font-semibold shadow-xs border border-border/40"
                  : "hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              <span className="text-[11px]">{label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

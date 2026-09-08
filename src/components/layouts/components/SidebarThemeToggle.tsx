"use client";

import { Laptop2, Moon, SunMedium } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import type { ThemePreference } from "@/lib/theme";

const themeOptions: {
  value: ThemePreference;
  label: string;
  Icon: typeof SunMedium;
}[] = [
  { value: "light", label: "Light", Icon: SunMedium },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "Auto", Icon: Laptop2 },
];

export function SidebarThemeToggle() {
  const { theme, setTheme, mounted } = useTheme();
  const { state } = useSidebar();

  const isCollapsed = state === "collapsed";

  const nextTheme: Record<ThemePreference, ThemePreference> = {
    light: "dark",
    dark: "system",
    system: "light",
  };

  const currentIcon = () => {
    if (!mounted) return <SunMedium className="size-4" />;
    if (theme === "dark") return <Moon className="size-4" />;
    if (theme === "system") return <Laptop2 className="size-4" />;
    return <SunMedium className="size-4" />;
  };

  if (isCollapsed) {
    return (
      <div className="flex w-full items-center justify-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(nextTheme[theme])}
          title={`Current theme: ${theme}. Click to switch.`}
          className="size-10 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors flex items-center justify-center shrink-0"
        >
          {currentIcon()}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 px-1 py-1 transition-opacity duration-150">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Theme
        </span>
        {mounted && (
          <span className="text-[10px] font-medium capitalize text-muted-foreground">
            {theme}
          </span>
        )}
      </div>
      <div
        className="flex items-center gap-0.5 rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-0.5"
        role="group"
        aria-label="Theme preference"
      >
        {themeOptions.map(({ value, label, Icon }) => {
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
                "h-6.5 flex-1 gap-1.5 rounded-md text-[11px] font-medium text-muted-foreground transition-all duration-150",
                isSelected
                  ? "bg-card text-foreground font-semibold shadow-2xs border border-border/50"
                  : "hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="size-3" />
              <span>{label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

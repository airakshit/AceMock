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
          className="size-10 rounded-lg text-white/75 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center shrink-0"
        >
          {currentIcon()}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 px-1 py-1 transition-opacity duration-150">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
          Theme
        </span>
        {mounted && (
          <span className="text-[10px] font-medium capitalize text-white/70">
            {theme}
          </span>
        )}
      </div>
      <div
        className="flex items-center gap-0.5 rounded-lg border border-white/20 bg-white/10 p-0.5"
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
                "h-6.5 flex-1 gap-1.5 rounded-md text-[11px] font-medium transition-all duration-150",
                isSelected
                  ? "bg-sidebar-foreground font-semibold text-sidebar"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
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

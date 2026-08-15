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
    { value: "light", label: "Light", Icon: SunMedium },
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "system", label: "System", Icon: Laptop2 },
];

export function SidebarThemeToggle() {
    const { theme, setTheme, mounted } = useTheme();

    return (
        <div className="space-y-2 px-2 pb-2">
            <p className="px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Theme
            </p>
            <div
                className="flex items-center gap-0.5 rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-0.5"
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
                            size="icon-sm"
                            onClick={() => setTheme(value)}
                            aria-label={`${label} theme`}
                            aria-pressed={isSelected}
                            className={cn(
                                "h-8 flex-1 rounded-md text-muted-foreground transition-colors",
                                isSelected &&
                                    "bg-background text-foreground shadow-sm",
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

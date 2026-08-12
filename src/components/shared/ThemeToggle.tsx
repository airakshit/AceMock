"use client";

import { useEffect, useState } from "react";
import { Laptop2, Moon, SunMedium } from "lucide-react";
import { Button } from "@/components/ui/button";

type ThemePreference = "light" | "dark" | "system";

type ThemeOption = {
    value: ThemePreference;
    label: string;
    Icon: typeof Laptop2;
};

const themeOptions: ThemeOption[] = [
    { value: "system", label: "System", Icon: Laptop2 },
    { value: "light", label: "Light", Icon: SunMedium },
    { value: "dark", label: "Dark", Icon: Moon },
];

const THEME_STORAGE_KEY = "theme-preference";

function applyTheme(theme: ThemePreference) {
    const root = document.documentElement;

    if (theme === "system") {
        const prefersDark = window.matchMedia(
            "(prefers-color-scheme: dark)",
        ).matches;
        root.classList.toggle("dark", prefersDark);
        return;
    }

    root.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle() {
    const [theme, setTheme] = useState<ThemePreference>("system");

    useEffect(() => {
        const savedTheme = window.localStorage.getItem(
            THEME_STORAGE_KEY,
        ) as ThemePreference | null;
        const initialTheme = savedTheme ?? "system";

        setTheme(initialTheme);
        applyTheme(initialTheme);
    }, []);

    useEffect(() => {
        if (theme !== "system") {
            return;
        }

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = () => applyTheme("system");

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [theme]);

    const handleSelect = (value: ThemePreference) => {
        setTheme(value);
        window.localStorage.setItem(THEME_STORAGE_KEY, value);
        applyTheme(value);
    };

    return (
        <div className="flex min-w-44 flex-col gap-2 rounded-3xl border border-border bg-muted/60 p-2 text-xs text-muted-foreground shadow-sm shadow-black/5 backdrop-blur dark:shadow-black/10">
            <span className="font-medium uppercase tracking-[0.3em] text-muted-foreground/80">
                Theme
            </span>
            <div className="inline-flex h-10 w-full items-center justify-between gap-1 rounded-3xl bg-background/80 p-1">
                {themeOptions.map(({ value, Icon, label }) => (
                    <Button
                        key={value}
                        type="button"
                        variant={theme === value ? "default" : "outline"}
                        size="icon"
                        onClick={() => handleSelect(value)}
                        aria-label={`Set ${label} theme`}
                        className="h-9 w-9 rounded-2xl p-0"
                    >
                        <Icon className="h-4 w-4" />
                    </Button>
                ))}
            </div>
        </div>
    );
}

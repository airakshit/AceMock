"use client";

import { useEffect, useState } from "react";

import {
  applyTheme,
  getStoredTheme,
  setThemePreference,
  type ThemePreference,
} from "@/lib/theme";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
    setMounted(true);
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

  const setTheme = (value: ThemePreference) => {
    setThemeState(value);
    setThemePreference(value);
  };

  return { theme, setTheme, mounted };
}

export const THEME_STORAGE_KEY = "theme-preference";

export type ThemePreference = "light" | "dark" | "system";

export const THEME_OPTIONS: ThemePreference[] = ["light", "dark", "system"];

export function isThemePreference(value: string | null): value is ThemePreference {
    return value === "light" || value === "dark" || value === "system";
}

export function resolveIsDark(theme: ThemePreference): boolean {
    if (theme === "dark") {
        return true;
    }

    if (theme === "light") {
        return false;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(theme: ThemePreference) {
    const root = document.documentElement;
    const isDark = resolveIsDark(theme);

    root.classList.toggle("dark", isDark);
    root.style.colorScheme = isDark ? "dark" : "light";
}

export function getStoredTheme(): ThemePreference {
    if (typeof window === "undefined") {
        return "system";
    }

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
}

export function setThemePreference(theme: ThemePreference) {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    applyTheme(theme);
}

/** Inline script for root layout — prevents flash of wrong theme. */
export const themeInitScript = `
(function () {
  try {
    var key = "${THEME_STORAGE_KEY}";
    var theme = localStorage.getItem(key);
    var root = document.documentElement;
    var isDark =
      theme === "dark" ||
      (theme !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    root.classList.toggle("dark", isDark);
    root.style.colorScheme = isDark ? "dark" : "light";

    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", function () {
        var current = localStorage.getItem(key);
        if (!current || current === "system") {
          var prefersDark = window.matchMedia(
            "(prefers-color-scheme: dark)",
          ).matches;
          root.classList.toggle("dark", prefersDark);
          root.style.colorScheme = prefersDark ? "dark" : "light";
        }
      });
  } catch (error) {
    /* ignore */
  }
})();
`;

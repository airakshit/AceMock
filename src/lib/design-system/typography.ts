/**
 * Typography utility classes — use with cn() for consistent text styles.
 */
export const typography = {
    display: "text-2xl font-semibold tracking-tight text-foreground sm:text-[length:var(--text-display)]",
    title: "text-xl font-semibold tracking-tight text-foreground",
    subtitle: "text-sm text-muted-foreground",
    body: "text-sm text-foreground",
    caption: "text-xs text-muted-foreground",
    link: "text-sm font-medium text-foreground underline-offset-4 hover:underline",
} as const;

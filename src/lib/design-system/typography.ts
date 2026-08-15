/**
 * Typography utility classes — use with cn() for consistent text styles.
 */
export const typography = {
    display:
        "font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-[length:var(--text-display)]",
    pageTitle:
        "font-heading text-lg font-semibold tracking-tight text-foreground md:text-xl",
    pageSubtitle: "text-sm leading-relaxed text-muted-foreground",
    sectionTitle:
        "font-heading text-base font-semibold tracking-tight text-foreground md:text-[length:var(--text-title)]",
    sectionSubtitle: "text-sm leading-relaxed text-muted-foreground",
    body: "text-sm leading-relaxed text-foreground",
    bodyMuted: "text-sm leading-relaxed text-muted-foreground",
    label:
        "text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground",
    caption: "text-xs leading-normal text-muted-foreground",
    metric: "font-heading text-2xl font-semibold tabular-nums tracking-tight",
    link: "text-sm font-medium text-foreground underline-offset-4 hover:underline",
} as const;

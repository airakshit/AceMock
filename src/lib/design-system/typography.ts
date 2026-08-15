/**
 * Typography utility classes — use with cn() for consistent text styles.
 */
export const typography = {
    display:
        "font-cursive text-3xl font-semibold leading-none tracking-normal text-foreground sm:text-4xl",
    pageTitle:
        "font-cursive text-2xl font-normal leading-none tracking-wide text-foreground md:text-3xl",
    pageSubtitle: "font-sans text-sm leading-relaxed text-muted-foreground",
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

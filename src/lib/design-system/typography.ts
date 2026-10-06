/**
 * Typography Design System — ePeX
 * 
 * Standardized typography classes calibrated for visual hierarchy,
 * optical kerning, and legibility across light and dark modes.
 * Pair with `cn()` in components.
 */

export const typography = {
  /** High-impact headline for heroes and landing moments */
  hero: "font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl leading-tight text-balance",

  /** Primary page header (e.g. Dashboard, Mock Tests, Documents) */
  pageTitle: "font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl leading-tight",

  /** Explanatory subtitle directly below a page title */
  pageSubtitle: "text-sm md:text-base font-normal leading-relaxed text-muted-foreground",

  /** Section title inside a page or view */
  sectionTitle: "font-heading text-lg font-semibold tracking-tight text-foreground md:text-xl",

  /** Explanatory caption below a section title */
  sectionSubtitle: "text-xs md:text-sm font-normal leading-relaxed text-muted-foreground",

  /** Card heading (e.g., test titles, document names) */
  cardTitle: "font-heading text-base font-semibold leading-snug tracking-tight text-foreground",

  /** Secondary helper text inside cards */
  cardSubtitle: "text-xs leading-relaxed text-muted-foreground",

  /** Large tabular numeral for metrics, statistics, and scores */
  metric: "font-heading text-2xl md:text-3xl font-bold tabular-nums tracking-tight text-foreground",

  /** Small uppercase kicker/eyebrow tag (e.g., "FEATURED TEST", "OVERVIEW") */
  eyebrow: "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground",

  /** Standard body reading copy */
  body: "text-sm leading-relaxed text-foreground",

  /** Muted secondary body copy */
  bodyMuted: "text-sm leading-relaxed text-muted-foreground",

  /** Micro-copy, timestamp, and metadata */
  caption: "text-xs leading-normal text-muted-foreground",

  /** Monospace code, formula, or hash */
  code: "font-mono text-xs font-medium tracking-tight",

  /** Interactive link styling */
  link: "text-sm font-medium text-brand hover:text-brand-hover underline-offset-4 hover:underline transition-colors",

  /** Legacy alias for backwards compatibility */
  display: "font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl leading-tight",
  label: "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground",
} as const;

export type TypographyVariant = keyof typeof typography;

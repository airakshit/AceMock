/**
 * Layout utility classes — page shells, containers, and spacing.
 */
export const layout = {
  pageShell:
    "relative flex min-h-dvh flex-col items-center justify-center bg-background px-[var(--space-page-x)] py-[var(--space-page-y)]",
  pageContainer: "w-full max-w-[var(--auth-card-max-width)]",
  stack: "flex flex-col gap-[var(--space-auth-section)]",
  fieldStack: "flex flex-col gap-[var(--space-auth-field)]",
} as const;

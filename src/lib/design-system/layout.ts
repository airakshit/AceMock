/**
 * Layout Design Tokens — ePeX
 * 
 * Standard page shells, containers, responsive grids, and spacing primitives.
 */

export const layout = {
  /** Centered page shell for authentication and standalone flows */
  pageShell:
    "relative flex min-h-dvh flex-col items-center justify-center bg-background px-[var(--space-page-x)] py-[var(--space-page-y)] overflow-hidden",

  /** Authenticated application content canvas */
  appContent: "flex-1 overflow-auto p-4 md:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto w-full",

  /** Auth card width container */
  pageContainer: "w-full max-w-[var(--auth-card-max-width)]",

  /** General vertical stack */
  stack: "flex flex-col gap-[var(--space-auth-section)]",

  /** Form field spacing */
  fieldStack: "flex flex-col gap-[var(--space-auth-field)]",

  /** Responsive card grid for mock tests and document lists */
  gridCards: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",

  /** Responsive metrics grid (2 to 4 columns depending on viewport) */
  gridMetrics: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",

  /** Page header layout container */
  headerContainer: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2",
} as const;

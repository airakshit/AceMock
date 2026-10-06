/**
 * Motion & Interaction Design Tokens — ePeX
 * 
 * Standard micro-interaction and transition utility classes.
 * Polished, sharp, and non-intrusive.
 */

export const motion = {
  /** Subtle border transition on hover for interactive cards */
  cardHover: "transition-colors duration-150 ease-out hover:border-foreground/25",

  /** Instant tactile press feedback on buttons and interactive chips */
  buttonPress: "active:scale-[0.99] transition-transform duration-75",

  /** Smooth color transition for links, tabs, and toggles */
  transitionColor: "transition-colors duration-150 ease-in-out",

  /** Default smooth transition for layout elements */
  transitionAll: "transition-all duration-150 ease-out",

  /** Clean focus ring for keyboard accessibility */
  focusRing: "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30",
} as const;

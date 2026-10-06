import { cn } from "@/lib/utils";

export type BrandWordmarkTone = "onDark" | "onLight" | "onBrand";

const toneStyles: Record<
  BrandWordmarkTone,
  { base: string; accent: string; badge?: string }
> = {
  /** White on dark or emerald brand canvas — accent pops in luminous mint/emerald */
  onDark: { base: "text-white", accent: "text-emerald-300" },
  /** Adaptive foreground on light/dark surfaces — accent follows emerald/success */
  onLight: { base: "text-foreground", accent: "text-emerald-600 dark:text-emerald-400" },
  /** Crisp white on the emerald sidebar — accent lifts in radiant mint */
  onBrand: { base: "text-white", accent: "text-emerald-200" },
};

export interface BrandWordmarkProps {
  tone?: BrandWordmarkTone;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses: Record<NonNullable<BrandWordmarkProps["size"]>, string> = {
  sm: "text-xs tracking-tight",
  md: "text-sm sm:text-base tracking-tight",
  lg: "text-lg sm:text-xl tracking-tight",
  xl: "text-2xl sm:text-3xl tracking-tight",
};

/**
 * BrandWordmark — the aesthetic ePeX wordmark.
 *
 * Renders "ePe" in the surface base tone and accentuates the final "X"
 * in a luminous emerald/mint tint, expressing the mathematical exponential
 * focus of ePeX (e^x).
 */
export function BrandWordmark({
  tone = "onLight",
  className,
  size,
}: BrandWordmarkProps) {
  const styles = toneStyles[tone];

  return (
    <span
      className={cn(
        "font-heading font-extrabold select-none inline-flex items-baseline",
        styles.base,
        size && sizeClasses[size],
        className,
      )}
    >
      <span>ePe</span>
      <span className={cn(styles.accent, "font-black drop-shadow-sm")}>X</span>
    </span>
  );
}

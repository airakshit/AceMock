/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandWordmark, type BrandWordmarkTone } from "./brand-wordmark";

export interface BrandIconProps {
  size?: number | string;
  className?: string;
}

/**
 * BrandIcon — renders the EXACT app icon: src/app/icon.svg (served at /icon.svg).
 *
 * That file is the single source of truth (it is also the browser-tab icon),
 * so the UI can never drift from the real icon. Nothing is re-drawn here.
 */
export function BrandIcon({ size = 36, className }: BrandIconProps) {
  return (
    <img
      src="/icon.svg"
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
      draggable={false}
      className={cn("shrink-0 select-none", className)}
    />
  );
}

export interface BrandLogoProps {
  variant?: "full" | "icon" | "wordmark";
  layout?: "horizontal" | "vertical";
  size?: "sm" | "md" | "lg" | "xl";
  tone?: BrandWordmarkTone;
  subtitle?: string | boolean;
  className?: string;
  iconClassName?: string;
  href?: string;
}

const sizeMap = {
  sm: { icon: 28, wordmark: "sm" as const, subtitle: "text-[9px]" },
  md: { icon: 34, wordmark: "md" as const, subtitle: "text-[10px]" },
  lg: { icon: 42, wordmark: "lg" as const, subtitle: "text-xs" },
  xl: { icon: 54, wordmark: "xl" as const, subtitle: "text-sm" },
};

/**
 * BrandLogo — Unified, consistent logo lockup for ePeX across the entire app.
 */
export function BrandLogo({
  variant = "full",
  layout = "horizontal",
  size = "md",
  tone = "onLight",
  subtitle = false,
  className,
  iconClassName,
  href,
}: BrandLogoProps) {
  const config = sizeMap[size];
  const defaultSubtitle =
    typeof subtitle === "string" ? subtitle : "Exam Prep & Analytics";

  const subtitleToneClass =
    tone === "onBrand"
      ? "text-sidebar-foreground/80"
      : tone === "onDark"
      ? "text-white/75"
      : "text-muted-foreground";

  const isVertical = layout === "vertical";

  const content = (
    <div
      className={cn(
        "inline-flex items-center",
        isVertical ? "flex-col justify-center gap-1.5 text-center" : "gap-2.5",
        className,
      )}
    >
      {variant !== "wordmark" && (
        <div
          className={cn(
            "relative flex shrink-0 items-center justify-center transition-transform duration-200 group-hover/brand:scale-105",
            iconClassName,
          )}
        >
          <BrandIcon size={config.icon} />
        </div>
      )}

      {variant !== "icon" && (
        <div
          className={cn(
            "flex flex-col overflow-hidden leading-tight",
            isVertical && "items-center text-center",
          )}
        >
          <BrandWordmark tone={tone} size={config.wordmark} />
          {subtitle && (
            <span
              className={cn(
                "truncate font-medium tracking-wide uppercase",
                config.subtitle,
                subtitleToneClass,
              )}
            >
              {defaultSubtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "group/brand inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded-lg",
          isVertical && "flex-col justify-center text-center",
        )}
      >
        {content}
      </Link>
    );
  }

  return content;
}

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandWordmark, type BrandWordmarkTone } from "./brand-wordmark";

export interface BrandIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  withGlow?: boolean;
}

/**
 * BrandIcon — The exponential e^x logo mark for ePeX.
 *
 * Geometric squircle container rendered in the signature emerald green
 * that matches the app sidebar (oklch(0.47 0.13 163)), featuring:
 * 1. Euler's mathematical base "e" in elegant serif italics.
 * 2. Elevated superscript exponent "x" in radiant mint.
 * 3. Sweeping exponential growth curve y = e^x with peak vertex node.
 * 4. Coordinate grid ticks symbolizing mathematical rigor and test accuracy.
 */
export function BrandIcon({
  size = 36,
  className,
  withGlow = false,
  ...props
}: BrandIconProps) {
  const numSize = typeof size === "number" ? size : undefined;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={numSize ?? size}
      height={numSize ?? size}
      role="img"
      aria-label="ePeX Logo (e^x)"
      className={cn("shrink-0 select-none overflow-visible", className)}
      {...props}
    >
      <defs>
        {/* Emerald gradient tuned to --sidebar oklch(0.47 0.13 163) */}
        <linearGradient id="epex-svg-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#064E3B" />
          <stop offset="42%" stopColor="#047857" />
          <stop offset="85%" stopColor="#059669" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>

        {/* Specular border bevel */}
        <linearGradient
          id="epex-svg-border"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
          <stop offset="45%" stopColor="#6EE7B7" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#047857" stopOpacity="0.15" />
        </linearGradient>

        {/* Subtle glass radial sheen */}
        <radialGradient id="epex-svg-sheen" cx="30%" cy="20%" r="65%">
          <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.38" />
          <stop offset="50%" stopColor="#10B981" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#064E3B" stopOpacity="0" />
        </radialGradient>

        {/* Exponential trajectory curve gradient */}
        <linearGradient id="epex-svg-curve" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#059669" stopOpacity="0.2" />
          <stop offset="45%" stopColor="#34D399" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#A7F3D0" stopOpacity="1" />
        </linearGradient>

        {/* Exponent x luminous gradient */}
        <linearGradient
          id="epex-svg-x-grad"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="65%" stopColor="#A7F3D0" />
          <stop offset="100%" stopColor="#6EE7B7" />
        </linearGradient>

        {/* Depth shadows */}
        <filter
          id="epex-svg-shadow"
          x="-15%"
          y="-15%"
          width="130%"
          height="130%"
        >
          <feDropShadow
            dx="0"
            dy="8"
            stdDeviation="12"
            floodColor="#022C22"
            floodOpacity="0.45"
          />
        </filter>
        <filter
          id="epex-svg-text-shadow"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="6"
            floodColor="#022C22"
            floodOpacity="0.5"
          />
        </filter>
      </defs>

      {/* Outer ambient glow if enabled */}
      {withGlow && (
        <rect
          x="20"
          y="20"
          width="472"
          height="472"
          rx="116"
          fill="#10B981"
          opacity="0.3"
          className="blur-md"
        />
      )}

      {/* Main squircle body */}
      <rect
        x="24"
        y="24"
        width="464"
        height="464"
        rx="108"
        fill="url(#epex-svg-bg)"
        filter="url(#epex-svg-shadow)"
      />

      {/* Glass surface highlight */}
      <rect
        x="24"
        y="24"
        width="464"
        height="464"
        rx="108"
        fill="url(#epex-svg-sheen)"
      />

      {/* Inset specular border */}
      <rect
        x="27"
        y="27"
        width="458"
        height="458"
        rx="105"
        fill="none"
        stroke="url(#epex-svg-border)"
        strokeWidth="6"
      />

      {/* Coordinate axes & graduation ticks */}
      <g opacity="0.32">
        <line
          x1="80"
          y1="388"
          x2="432"
          y2="388"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="3 7"
        />
        <line
          x1="120"
          y1="416"
          x2="120"
          y2="112"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="3 7"
        />
        <line
          x1="200"
          y1="384"
          x2="200"
          y2="392"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="280"
          y1="384"
          x2="280"
          y2="392"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="360"
          y1="384"
          x2="360"
          y2="392"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>

      {/* Exponential growth curve y = e^x */}
      <path
        d="M 88 388 C 176 386 264 374 316 304 C 352 254 382 194 408 132"
        fill="none"
        stroke="#34D399"
        strokeWidth="14"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M 88 388 C 176 386 264 374 316 304 C 352 254 382 194 408 132"
        fill="none"
        stroke="url(#epex-svg-curve)"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* Peak node */}
      <circle cx="408" cy="132" r="8" fill="#A7F3D0" opacity="0.4" />
      <circle cx="408" cy="132" r="5" fill="#6EE7B7" />
      <circle cx="408" cy="132" r="2.5" fill="#FFFFFF" />

      {/* Euler's constant: italic e */}
      <text
        x="188"
        y="348"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="240"
        fontStyle="italic"
        fontWeight="700"
        fill="#FFFFFF"
        textAnchor="middle"
        filter="url(#epex-svg-text-shadow)"
      >
        e
      </text>

      {/* Elevated exponent: luminous x */}
      <text
        x="326"
        y="214"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="155"
        fontStyle="italic"
        fontWeight="700"
        fill="url(#epex-svg-x-grad)"
        filter="url(#epex-svg-text-shadow)"
      >
        x
      </text>
    </svg>
  );
}

export interface BrandLogoProps {
  variant?: "full" | "icon" | "wordmark";
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

  const content = (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
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
        <div className="flex flex-col overflow-hidden leading-tight">
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
        className="group/brand inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded-lg"
      >
        {content}
      </Link>
    );
  }

  return content;
}

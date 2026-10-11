"use client";

import { BrandLogo } from "@/components/icons/brand-logo";
import { BrandWordmark } from "@/components/icons/brand-wordmark";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AuthHeroProps {
  variant?: "signin" | "signup";
  className?: string;
}

/**
 * AuthHero — the brand-establishing header for auth screens.
 * Small screens: compact lockup + tagline.
 * Large screens: expands into a full editorial moment (handled by AuthBrandPanel).
 */
export function AuthHero({ variant = "signin", className }: AuthHeroProps) {
  const headlines = {
    signin: {
      main: "Welcome back.",
      sub: "Continue your exponential growth.",
    },
    signup: {
      main: "Start your journey.",
      sub: "Practice sharper. Score exponentially.",
    },
  };

  const { main, sub } = headlines[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={cn("relative z-10", className)}
    >
      {/* Brand Lockup — small screens only; large screens show branding in the side panel */}
      <div className="flex items-center justify-center gap-3 mb-6 lg:hidden">
        <BrandLogo variant="icon" size="xl" tone="onBrand" />
        <BrandWordmark tone="onBrand" size="xl" />
      </div>

      {/* Headline & Tagline — white over the green canvas on small screens, theme colors on large */}
      <div className="text-center space-y-2">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="font-heading font-extrabold text-3xl sm:text-4xl tracking-tight text-white lg:text-foreground text-balance"
        >
          {main}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-sm sm:text-base font-medium text-white/80 lg:text-muted-foreground max-w-xs mx-auto text-balance"
        >
          {sub}
        </motion.p>
      </div>

      {/* Decorative accent line */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mt-6 h-px w-24 mx-auto bg-gradient-to-r from-transparent via-white/40 lg:via-emerald-400/60 to-transparent"
      />
    </motion.div>
  );
}
"use client";

import { cn } from "@/lib/utils";
import { layout } from "@/lib/design-system";
import { motion } from "framer-motion";

interface AuthCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "elevated";
}

export function AuthCard({ children, className, variant = "default" }: AuthCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        layout.stack,
        "relative rounded-2xl overflow-hidden",
        variant === "default" &&
          "bg-card/80 backdrop-blur-xl border border-border/50 shadow-2xl dark:border-border/30",
        variant === "elevated" &&
          "bg-card border border-border/60 shadow-xl",
        className,
      )}
    >
      {/* Subtle top accent border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
      <div className="relative p-6 sm:p-8">{children}</div>
    </motion.div>
  );
}
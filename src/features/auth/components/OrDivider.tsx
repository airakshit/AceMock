"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface OrDividerProps {
  label?: string;
  className?: string;
}

export function OrDivider({ label = "or", className }: OrDividerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex items-center gap-3 my-1", className)}
      role="separator"
      aria-label={label}
    >
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.35, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent"
      />
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        {label}
      </span>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.35, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 h-px bg-gradient-to-r from-border via-transparent to-transparent"
      />
    </motion.div>
  );
}
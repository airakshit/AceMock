"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { typography } from "@/lib/design-system";

interface AuthSwitchLinkProps {
  prompt: string;
  linkText: string;
  href: string;
  className?: string;
}

export function AuthSwitchLink({ prompt, linkText, href, className }: AuthSwitchLinkProps) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(typography.bodyMuted, "mt-4 text-center text-xs", className)}
    >
      {prompt}{" "}
      <motion.span whileHover={{ x: 2 }}>
        <Link
          href={href}
          className="relative font-medium text-brand hover:text-brand-accent transition-colors after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-full after:origin-bottom-right after:scale-x-0 after:bg-current after:transition-transform hover:after:origin-bottom-left hover:after:scale-x-100"
        >
          {linkText}
        </Link>
      </motion.span>
    </motion.p>
  );
}
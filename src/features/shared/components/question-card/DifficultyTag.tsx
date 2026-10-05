"use client";

import { cn } from "@/lib/utils";
import type { QuestionDifficultyLevel } from "./types";

const DIFFICULTY_STYLES: Record<
  QuestionDifficultyLevel,
  { label: string; className: string }
> = {
  easy: {
    label: "Easy",
    className: "bg-success/10 text-success",
  },
  medium: {
    label: "Medium",
    className: "bg-warning/10 text-warning",
  },
  hard: {
    label: "Hard",
    className: "bg-danger/10 text-danger",
  },
};

interface DifficultyTagProps {
  difficulty: QuestionDifficultyLevel;
  className?: string;
}

/**
 * Compact difficulty chip for the QuestionCard header.
 * Visually secondary to the subject tag (smaller type, tighter padding).
 */
export function DifficultyTag({ difficulty, className }: DifficultyTagProps) {
  const style = DIFFICULTY_STYLES[difficulty];
  if (!style) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        style.className,
        className,
      )}
    >
      {style.label}
    </span>
  );
}

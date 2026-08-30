"use client";

import { cn } from "@/lib/utils";
import type { QuestionSubject } from "./types";

const SUBJECT_STYLES: Record<
  QuestionSubject,
  { label: string; bg: string; text: string }
> = {
  physics: {
    label: "Physics",
    bg: "bg-blue-500/10 dark:bg-blue-400/15",
    text: "text-blue-700 dark:text-blue-400",
  },
  chemistry: {
    label: "Chemistry",
    bg: "bg-emerald-500/10 dark:bg-emerald-400/15",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  mathematics: {
    label: "Mathematics",
    bg: "bg-purple-500/10 dark:bg-purple-400/15",
    text: "text-purple-700 dark:text-purple-400",
  },
};

interface SubjectTagProps {
  subject: QuestionSubject;
  className?: string;
}

export function SubjectTag({ subject, className }: SubjectTagProps) {
  const style = SUBJECT_STYLES[subject];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide",
        style.bg,
        style.text,
        className,
      )}
    >
      {style.label}
    </span>
  );
}

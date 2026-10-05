"use client";

import { cn } from "@/lib/utils";
import type { QuestionSubject } from "./types";

/**
 * Subject tags use the scheme's category accents (see design-tokens.css):
 *   physics → blue · chemistry → success · mathematics → violet
 *   english → warning · general → neutral
 * Each follows the same tint recipe so the row reads as one system.
 */
const SUBJECT_STYLES: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  physics: {
    label: "Physics",
    bg: "bg-cat-physics/10",
    text: "text-cat-physics",
  },
  chemistry: {
    label: "Chemistry",
    bg: "bg-success/10",
    text: "text-success",
  },
  mathematics: {
    label: "Mathematics",
    bg: "bg-cat-math/10",
    text: "text-cat-math",
  },
  english: {
    label: "English",
    bg: "bg-warning/10",
    text: "text-warning",
  },
  general: {
    label: "General",
    bg: "bg-cat-general/10",
    text: "text-cat-general",
  },
};

interface SubjectTagProps {
  subject: QuestionSubject;
  className?: string;
}

export function SubjectTag({ subject, className }: SubjectTagProps) {
  const normalizedKey = (subject || "general").toLowerCase();
  const style = SUBJECT_STYLES[normalizedKey] || {
    label: subject ? subject.charAt(0).toUpperCase() + subject.slice(1) : "General",
    bg: "bg-cat-general/10",
    text: "text-cat-general",
  };

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

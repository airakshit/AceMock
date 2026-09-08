/**
 * Colors & Semantic Tokens — Ace Mock
 * 
 * Reusable color tokens for test difficulty, upload statuses,
 * metric accents, and visual hierarchy.
 */

export type DifficultyLevel = "Easy" | "Medium" | "Hard";
export type MetricAccent = "default" | "brand" | "success" | "info" | "warning";
export type UploadStatus = "uploaded" | "uploading" | "failed";

export const colors = {
  /** Difficulty indicator badges & dots */
  difficulty: {
    Easy: {
      badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
      dot: "bg-emerald-500",
      label: "Easy",
    },
    Medium: {
      badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
      dot: "bg-amber-500",
      label: "Medium",
    },
    Hard: {
      badge: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
      dot: "bg-rose-500",
      label: "Hard",
    },
  },

  /** Metric card accents with soft ambient pill styling */
  metricAccent: {
    default: "bg-muted/80 text-foreground border-border/50",
    brand: "bg-brand/10 text-brand border-brand/20",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    info: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },

  /** Document and file upload status pills */
  status: {
    uploaded: {
      badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
      dot: "bg-emerald-500",
      label: "Uploaded",
    },
    uploading: {
      badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
      dot: "bg-amber-500",
      label: "Uploading",
    },
    failed: {
      badge: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
      dot: "bg-rose-500",
      label: "Failed",
    },
  },
} as const;

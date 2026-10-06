/**
 * Colors & Semantic Tokens — ePeX
 *
 * The app's color scheme in one place. Every role maps to a semantic token
 * (defined in styles/design-tokens.css, exposed as Tailwind colors), so a
 * badge looks correct in light and dark mode with no `dark:` variants:
 *
 *   success (emerald) · correct, Easy, uploaded, positive trends
 *   warning (amber)   · Medium, pending, uploads, hints, time pressure
 *   danger  (rose)    · incorrect, Hard, failed, destructive
 *   info    (cyan)    · processing, documents, tips
 *   brand   (indigo)  · identity, primary actions, focus
 */

export type DifficultyLevel = "Easy" | "Medium" | "Hard";
export type MetricAccent = "default" | "brand" | "success" | "info" | "warning";
export type UploadStatus = "uploaded" | "uploading" | "failed";

export const colors = {
  /** Difficulty indicator badges & dots */
  difficulty: {
    Easy: {
      badge: "bg-success/10 text-success border-success/25",
      dot: "bg-success",
      label: "Easy",
    },
    Medium: {
      badge: "bg-warning/10 text-warning border-warning/25",
      dot: "bg-warning",
      label: "Medium",
    },
    Hard: {
      badge: "bg-danger/10 text-danger border-danger/25",
      dot: "bg-danger",
      label: "Hard",
    },
  },

  /** Metric card accents with soft ambient pill styling */
  metricAccent: {
    default: "bg-muted/80 text-foreground border-border/50",
    brand: "bg-brand/10 text-brand border-brand/20",
    success: "bg-success/10 text-success border-success/20",
    info: "bg-info/10 text-info border-info/20",
    warning: "bg-warning/10 text-warning border-warning/20",
  },

  /** Document and file upload status pills */
  status: {
    uploaded: {
      badge: "bg-success/10 text-success border-success/25",
      dot: "bg-success",
      label: "Uploaded",
    },
    uploading: {
      badge: "bg-warning/10 text-warning border-warning/25",
      dot: "bg-warning",
      label: "Uploading",
    },
    failed: {
      badge: "bg-danger/10 text-danger border-danger/25",
      dot: "bg-danger",
      label: "Failed",
    },
  },
} as const;

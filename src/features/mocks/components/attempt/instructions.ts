import type { MockTestAttemptMeta } from "./types";

export type InstructionKey = "negative" | "options" | "partial" | "timer";

export interface InstructionItem {
  key: InstructionKey;
  text: string;
}

/** Formats seconds as a compact human duration, e.g. "1 hr 30 min" or "45 min". */
export function formatDuration(totalSeconds: number): string {
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} hr ${minutes} min`;
  if (hours > 0) return `${hours} hr`;
  return `${minutes} min`;
}

/** Formats seconds as a running clock, e.g. "01:30:00". */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Builds the exam rules that are NOT already obvious from the summary
 * chips (questions / marks / duration / negative %) shown in the dialog.
 */
export function buildInstructions(
  meta: MockTestAttemptMeta,
): InstructionItem[] {
  const negativePercent = meta.negativePercentagePerQuestion;
  const items: InstructionItem[] = [];

  if (negativePercent > 0) {
    items.push({
      key: "negative",
      text: `Wrong answers carry a penalty — ${negativePercent}% of that question's marks is deducted from your total score.`,
    });
  }

  items.push(
    {
      key: "options",
      text: "Each question offers four options (A–D) with exactly one correct answer.",
    },
    {
      key: "partial",
      text: "Unanswered questions score zero — skipping a question carries no penalty.",
    },
    {
      key: "timer",
      text: "The test is submitted automatically the moment the timer reaches zero.",
    },
  );

  return items;
}

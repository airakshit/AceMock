"use client";

import { useCallback, useRef } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichContent } from "./rendering/RichContent";
import type { OptionKey, OptionType, QuestionMode } from "./types";

interface OptionsListProps {
  options: OptionType[];
  correctOption: OptionKey;
  mode: QuestionMode;
  selectedAnswer: OptionKey | null;
  onAnswerChange: (key: OptionKey) => void;
  disabled?: boolean;
}

type OptionState =
  | "default"
  | "selected"
  | "correct"
  | "incorrect-selected"
  | "correct-unselected";

function getOptionState(
  key: OptionKey,
  correctOption: OptionKey,
  selectedAnswer: OptionKey | null,
  mode: QuestionMode,
): OptionState {
  if (mode === "exam") {
    return selectedAnswer === key ? "selected" : "default";
  }

  // Review mode
  const isCorrectKey = key === correctOption;
  const isSelected = selectedAnswer === key;

  if (isCorrectKey && isSelected) return "correct";
  if (isCorrectKey && !isSelected) return "correct-unselected";
  if (!isCorrectKey && isSelected) return "incorrect-selected";
  return "default";
}

const STATE_STYLES: Record<OptionState, string> = {
  default:
    "border-border bg-card/60 hover:border-primary/40 hover:bg-accent/30",
  selected:
    "border-primary bg-primary/5 ring-1 ring-primary/30",
  correct:
    "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30",
  "incorrect-selected":
    "border-red-500 bg-red-500/10 ring-1 ring-red-500/30",
  "correct-unselected":
    "border-emerald-500/50 bg-emerald-500/5",
};

const BADGE_STYLES: Record<OptionState, string> = {
  default: "bg-muted text-muted-foreground",
  selected: "bg-primary text-primary-foreground shadow-xs",
  correct: "bg-emerald-500 text-white shadow-xs",
  "incorrect-selected": "bg-red-500 text-white shadow-xs",
  "correct-unselected": "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
};

const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];

/**
 * MCQ option list — single-choice only (A B C D).
 *
 * - role="radiogroup" with aria-checked for each option
 * - Arrow key navigation between options
 * - Space / Enter to select
 * - Review mode: green for correct, red for wrong, green outline for missed correct
 * - Exam mode: never reads isCorrect — only shows selected state
 */
export function OptionsList({
  options,
  correctOption,
  mode,
  selectedAnswer,
  onAnswerChange,
  disabled = false,
}: OptionsListProps) {
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const isReview = mode === "review";
      let nextIndex = -1;

      switch (e.key) {
        case "ArrowDown":
        case "ArrowRight":
          e.preventDefault();
          nextIndex = (index + 1) % OPTION_KEYS.length;
          break;
        case "ArrowUp":
        case "ArrowLeft":
          e.preventDefault();
          nextIndex =
            (index - 1 + OPTION_KEYS.length) % OPTION_KEYS.length;
          break;
        case " ":
        case "Enter":
          e.preventDefault();
          if (!isReview && !disabled) {
            onAnswerChange(OPTION_KEYS[index]);
          }
          return;
        default:
          return;
      }

      optionRefs.current[nextIndex]?.focus();
      // Auto-select on arrow key navigation (standard radiogroup behaviour)
      if (!isReview && !disabled) {
        onAnswerChange(OPTION_KEYS[nextIndex]);
      }
    },
    [mode, disabled, onAnswerChange],
  );

  return (
    <div
      role="radiogroup"
      aria-label="Answer options"
      className="space-y-2"
    >
      {OPTION_KEYS.map((key, index) => {
        const option = options.find((o) => o.key === key);
        if (!option) return null;

        const state = getOptionState(key, correctOption, selectedAnswer, mode);
        const isReview = mode === "review";
        const isSelected = selectedAnswer === key;

        return (
          <div
            key={key}
            ref={(el) => {
              optionRefs.current[index] = el;
            }}
            role="radio"
            aria-checked={isSelected}
            aria-label={`Option ${key}: ${option.content}`}
            tabIndex={
              // First option or selected option gets tabIndex 0 (roving tabindex)
              isSelected || (!selectedAnswer && index === 0) ? 0 : -1
            }
            onClick={() => {
              if (!isReview && !disabled) onAnswerChange(key);
            }}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-3 transition-all cursor-pointer outline-none",
              "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1",
              STATE_STYLES[state],
              isReview && "cursor-default",
              disabled && "pointer-events-none opacity-60",
            )}
          >
            {/* Key badge */}
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold font-mono transition-colors",
                BADGE_STYLES[state],
              )}
            >
              {key}
            </div>

            {/* Option content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <RichContent text={option.content} className="text-sm" />
            </div>

            {/* Review mode indicators */}
            {isReview && state === "correct" && (
              <Check
                className="size-5 shrink-0 text-emerald-500 mt-1"
                aria-label="Correct answer"
              />
            )}
            {isReview && state === "incorrect-selected" && (
              <X
                className="size-5 shrink-0 text-red-500 mt-1"
                aria-label="Incorrect answer"
              />
            )}
            {isReview && state === "correct-unselected" && (
              <Check
                className="size-5 shrink-0 text-emerald-400 mt-1 opacity-60"
                aria-label="This was the correct answer"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

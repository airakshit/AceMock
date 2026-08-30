"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { QuestionOption, QuestionOptionKey } from "../types";

interface OptionsEditorProps {
  options: QuestionOption[];
  correctOption: QuestionOptionKey;
  onOptionsChange: (newOptions: QuestionOption[]) => void;
  onCorrectOptionChange: (key: QuestionOptionKey) => void;
  disabled?: boolean;
  errors?: Record<number, string | undefined>;
}

const OPTION_KEYS: QuestionOptionKey[] = ["A", "B", "C", "D"];

export function OptionsEditor({
  options,
  correctOption,
  onOptionsChange,
  onCorrectOptionChange,
  disabled = false,
  errors,
}: OptionsEditorProps) {
  const handleTextChange = (key: QuestionOptionKey, text: string) => {
    const updated = options.map((opt) =>
      opt.key === key ? { ...opt, text } : opt,
    );
    onOptionsChange(updated);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Answer Options (4 Required)
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {OPTION_KEYS.map((key, index) => {
          const currentOpt = options.find((o) => o.key === key) || {
            key,
            text: "",
          };
          const isCorrect = correctOption === key;
          const errorMessage = errors?.[index];

          return (
            <div
              key={key}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border p-2.5 transition-all bg-card/60",
                isCorrect
                  ? "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                  : "border-border hover:border-primary/40",
                errorMessage && "border-destructive/60 bg-destructive/5",
              )}
            >
              {/* Option Key Badge */}
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg font-bold text-sm font-mono transition-colors",
                  isCorrect
                    ? "bg-emerald-500 text-white shadow-xs"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {key}
              </div>

              {/* Option Text Input */}
              <div className="flex-1 min-w-0">
                <Input
                  value={currentOpt.text}
                  disabled={disabled}
                  placeholder={`Option ${key}...`}
                  onChange={(e) => handleTextChange(key, e.target.value)}
                  className={cn(
                    "h-8 text-sm bg-transparent border-none shadow-none focus-visible:ring-0 px-1",
                    isCorrect && "font-medium",
                  )}
                />
                {errorMessage && (
                  <p className="text-xs text-destructive px-1 mt-0.5">
                    {errorMessage}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Correct Answer — mini radio row */}
      <div className="flex items-center gap-3 pt-1 pl-0.5">
        <span className="text-xs font-medium text-muted-foreground shrink-0">
          Correct answer:
        </span>
        <div className="flex items-center gap-5">
          {OPTION_KEYS.map((key) => {
            const isCorrect = correctOption === key;
            return (
              <label
                key={key}
                className={cn(
                  "flex items-center gap-1.5 cursor-pointer select-none group",
                  disabled && "pointer-events-none opacity-50",
                )}
                onClick={() => !disabled && onCorrectOptionChange(key)}
              >
                {/* Mini radio circle */}
                <span
                  className={cn(
                    "inline-flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    isCorrect
                      ? "border-emerald-500 bg-emerald-500"
                      : "border-muted-foreground/40 bg-background group-hover:border-emerald-400",
                  )}
                >
                  {isCorrect && (
                    <span className="block size-1.5 rounded-full bg-white" />
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm font-mono font-semibold transition-colors",
                    isCorrect
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {key}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

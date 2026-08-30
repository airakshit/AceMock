"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Answer Options (4 Required)
        </p>
        <span className="text-xs text-muted-foreground">
          Click the checkmark to set the correct answer
        </span>
      </div>

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
                "relative flex items-center gap-2.5 rounded-xl border p-2.5 transition-all bg-card/60",
                isCorrect
                  ? "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                  : "border-border hover:border-primary/40",
                errorMessage && "border-destructive/60 bg-destructive/5",
              )}
            >
              {/* Option Key Badge */}
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg font-bold text-xs font-mono transition-colors",
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
                  placeholder={`Option ${key} text...`}
                  onChange={(e) => handleTextChange(key, e.target.value)}
                  className={cn(
                    "h-8 text-sm bg-transparent border-none shadow-none focus-visible:ring-0 px-1",
                    isCorrect && "font-medium",
                  )}
                />
                {errorMessage && (
                  <p className="text-[11px] text-destructive px-1 mt-0.5">
                    {errorMessage}
                  </p>
                )}
              </div>

              {/* Correct Answer Selection Toggle */}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onCorrectOptionChange(key)}
                className={cn(
                  "flex items-center gap-1 shrink-0 rounded-lg px-2 py-1 text-xs font-medium transition-all cursor-pointer select-none",
                  isCorrect
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  disabled && "pointer-events-none opacity-50",
                )}
                title={
                  isCorrect
                    ? `Option ${key} is marked as correct`
                    : `Mark Option ${key} as correct`
                }
              >
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    <span className="hidden sm:inline">Correct</span>
                  </>
                ) : (
                  <>
                    <Circle className="size-3.5 opacity-40 shrink-0" />
                    <span className="hidden sm:inline">Mark Correct</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

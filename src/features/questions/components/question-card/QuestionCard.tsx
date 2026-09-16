"use client";

import { Lightbulb } from "lucide-react";
import { RichContent } from "./rendering/RichContent";
import { OptionsList } from "./OptionsList";
import { SubjectTag } from "./SubjectTag";
import { DiagramViewer } from "./DiagramViewer";
import type { QuestionCardProps } from "./types";

/**
 * QuestionCard — fully controlled MCQ question renderer.
 *
 * Supports two modes:
 * - `exam`: shows question + options with selected state. Never leaks correct answer.
 * - `review`: shows correct/incorrect highlighting, explanation, and solution diagram.
 *
 * Parent owns the selected-answer state via `selectedAnswer` + `onAnswerChange`.
 */
export function QuestionCard({
  question,
  questionNumber,
  mode,
  selectedAnswer,
  onAnswerChange,
}: QuestionCardProps) {
  const {
    subject,
    questionText,
    options,
    correctOption,
    explanation,
    marks,
    negativeMarks,
    diagramUrl,
    solutionDiagramUrl,
  } = question;

  return (
    <div className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          {questionNumber != null && (
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold font-mono">
              {questionNumber}
            </span>
          )}
          <SubjectTag subject={subject} />
        </div>

        {/* Marks info */}
        {(marks != null || negativeMarks != null) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            {marks != null && (
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-400">
                +{marks}
              </span>
            )}
            {negativeMarks != null && negativeMarks > 0 && (
              <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-700 dark:text-red-400">
                −{negativeMarks}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ─── Body ─── */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Question text */}
        <RichContent text={questionText} className="text-base" />

        {/* Question diagram (if present) */}
        <DiagramViewer
          url={diagramUrl}
          alt="Question diagram"
          label="Question Diagram"
        />

        {/* Options */}
        <OptionsList
          options={options}
          correctOption={correctOption}
          mode={mode}
          selectedAnswer={selectedAnswer}
          onAnswerChange={onAnswerChange}
        />

        {/* Explanation & Solution Working (review mode only) */}
        {mode === "review" && (explanation || solutionDiagramUrl) && (
          <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center gap-1.5">
              <Lightbulb className="size-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {explanation ? "Explanation" : "Solution"}
              </span>
            </div>
            {explanation && <RichContent text={explanation} className="text-sm" />}
            <DiagramViewer
              url={solutionDiagramUrl}
              alt="Solution working"
              label="Solution Working"
            />
          </div>
        )}
      </div>
    </div>
  );
}

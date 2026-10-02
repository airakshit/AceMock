"use client";

import { Lightbulb } from "lucide-react";
import { RichContent } from "./rendering/RichContent";
import { OptionsList } from "./OptionsList";
import { SubjectTag } from "./SubjectTag";
import { DifficultyTag } from "./DifficultyTag";
import { DiagramViewer } from "./DiagramViewer";
import { QuestionCardActions } from "./QuestionCardActions";
import type { QuestionCardProps } from "./types";

/**
 * QuestionCard — fully controlled MCQ question renderer.
 *
 * Supports two modes:
 * - `exam`: shows question + options with selected state. Never leaks correct answer.
 * - `review`: shows correct/incorrect highlighting, explanation, and solution diagram.
 *
 * Parent owns the selected-answer state via `selectedAnswer` + `onAnswerChange`.
 * Bookmark / report controls keep their own state (see QuestionCardActions).
 *
 * Layout:
 *   header  — [Q#] [subject] [difficulty] · [marks] │ [bookmark] [report]
 *   body    — question text, diagram, options, and (review) explanation
 */
export function QuestionCard({
  question,
  questionNumber,
  mode,
  selectedAnswer,
  onAnswerChange,
}: QuestionCardProps) {
  const {
    id,
    subject,
    difficulty,
    questionText,
    options,
    correctOption,
    explanation,
    marks,
    negativeMarks,
    diagramUrl,
    solutionDiagramUrl,
  } = question;

  const hasMarks = (marks != null && marks > 0) || (negativeMarks != null && negativeMarks > 0);

  return (
    <article className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md">
      {/* ─── Header ─── */}
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b bg-muted/30 px-4 py-3 sm:px-5">
        {/* Left: identity */}
        <div className="flex min-w-0 items-center gap-2">
          {questionNumber != null && (
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary ring-1 ring-primary/20"
              aria-label={`Question ${questionNumber}`}
            >
              {String(questionNumber).padStart(2, "0")}
            </span>
          )}
          <SubjectTag subject={subject} />
          {difficulty && <DifficultyTag difficulty={difficulty} />}
        </div>

        {/* Right: marks + actions */}
        <div className="flex items-center gap-2">
          {hasMarks && (
            <div className="flex items-center gap-1 font-mono text-xs">
              {marks != null && marks > 0 && (
                <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-700 dark:text-emerald-400">
                  +{marks}
                </span>
              )}
              {negativeMarks != null && negativeMarks > 0 && (
                <span className="rounded-md bg-red-500/10 px-1.5 py-0.5 font-semibold text-red-700 dark:text-red-400">
                  −{negativeMarks}
                </span>
              )}
            </div>
          )}

          {/* Visual divider between marks and card actions */}
          {hasMarks && (
            <div className="h-4 w-px bg-border" aria-hidden="true" />
          )}

          <QuestionCardActions questionId={id} />
        </div>
      </header>

      {/* ─── Body ─── */}
      <div className="space-y-5 p-4 sm:p-6">
        {/* Question text + optional diagram */}
        <div className="space-y-4">
          <RichContent text={questionText} className="text-base leading-relaxed" />
          <DiagramViewer
            url={diagramUrl}
            alt="Question diagram"
            label="Question Diagram"
          />
        </div>

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
          <section className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center gap-1.5">
              <Lightbulb className="size-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {explanation ? "Explanation" : "Solution"}
              </h4>
            </div>
            {explanation && <RichContent text={explanation} className="text-sm" />}
            <DiagramViewer
              url={solutionDiagramUrl}
              alt="Solution working"
              label="Solution Working"
            />
          </section>
        )}
      </div>
    </article>
  );
}

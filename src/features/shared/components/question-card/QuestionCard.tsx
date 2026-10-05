"use client";

import React from "react";
import { Eye, EyeOff, Lightbulb, Loader2, BookOpen, ChevronDown } from "lucide-react";

import { RichContent } from "./rendering/RichContent";
import { OptionsList } from "./OptionsList";
import { SubjectTag } from "./SubjectTag";
import { DifficultyTag } from "./DifficultyTag";
import { DiagramViewer } from "./DiagramViewer";
import { QuestionCardActions } from "./QuestionCardActions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuestionCardProps, PassageType } from "./types";

/** Collapsible passage panel for reading comprehension questions. */
function PassagePanel({ passage }: { passage: PassageType }) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  const range =
    passage.questionPositions.length > 1
      ? `Questions ${passage.questionPositions[0]}–${passage.questionPositions[passage.questionPositions.length - 1]}`
      : passage.questionPositions.length === 1
        ? `Question ${passage.questionPositions[0]}`
        : "";

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-card mb-4">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-4 py-2.5 text-left transition-colors hover:bg-muted/60"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <BookOpen className="size-4 text-primary" />
          Passage
          {range && (
            <span className="font-normal text-muted-foreground">· {range}</span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            !isExpanded && "-rotate-90",
          )}
        />
      </button>

      {isExpanded && (
        <div className="px-4 py-3">
          <RichContent text={passage.content} className="text-sm leading-relaxed text-foreground/90" />
        </div>
      )}
    </section>
  );
}

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
 * The footer solution controls only appear when `solutionControls` is
 * provided — the bookmarks page opts in; mock/test views never do, so
 * answers cannot be revealed there. The footer shows "View solution"
 * until the data is in memory, then toggles "Hide/Show solution" —
 * hiding keeps the loaded data, so re-showing never re-fetches.
 *
 * Layout:
 *   header  — [Q#] [subject] [difficulty] · [marks] │ [bookmark] [report]
 *   body    — passage (optional), question text, diagram, options, and (review) explanation
 *   footer  — [View/Hide/Show solution] (opt-in consumers only)
 */
export function QuestionCard({
  question,
  questionNumber,
  mode,
  selectedAnswer,
  pendingAnswer,
  onAnswerChange,
  isBookmarked = false,
  solutionControls,
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
    passage,
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
                <span className="rounded-md bg-success/10 px-1.5 py-0.5 font-semibold text-success">
                  +{marks}
                </span>
              )}
              {negativeMarks != null && negativeMarks > 0 && (
                <span className="rounded-md bg-danger/10 px-1.5 py-0.5 font-semibold text-danger">
                  −{negativeMarks}
                </span>
              )}
            </div>
          )}

          {/* Visual divider between marks and card actions */}
          {hasMarks && (
            <div className="h-4 w-px bg-border" aria-hidden="true" />
          )}

          <QuestionCardActions questionId={id} isBookmarked={isBookmarked} />
        </div>
      </header>

      {/* ─── Body ─── */}
      <div className="space-y-5 p-4 sm:p-6">
        {/* Passage (optional) */}
        {passage && <PassagePanel passage={passage} />}

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
          selectedAnswer={mode === "exam" && pendingAnswer ? pendingAnswer : selectedAnswer}
          onAnswerChange={onAnswerChange}
        />

        {/* Explanation & Solution Working (review mode only).
            When a solution was loaded but is empty, show N/A instead of
            silently hiding the section (bookmarks page). */}
        {mode === "review" &&
          (explanation || solutionDiagramUrl || solutionControls?.isLoaded) && (
            <section className="space-y-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
              <div className="flex items-center gap-1.5">
                <Lightbulb className="size-4 text-warning" />
                <h4 className="text-sm font-semibold text-warning">
                  {explanation ? "Explanation" : "Solution"}
                </h4>
              </div>
              {explanation ? (
                <RichContent text={explanation} className="text-sm" />
              ) : (
                !solutionDiagramUrl && (
                  <p className="text-sm font-medium text-muted-foreground">N/A</p>
                )
              )}
              <DiagramViewer
                url={solutionDiagramUrl}
                alt="Solution working"
                label="Solution Working"
              />
            </section>
          )}
      </div>

      {/* ─── Footer: opt-in solution controls (bookmarks page only) ─── */}
      {solutionControls && (
        <footer className="flex items-center justify-end border-t bg-muted/20 px-4 py-2.5 sm:px-5">
          {!solutionControls.isLoaded ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={solutionControls.onView}
              disabled={solutionControls.isLoading}
              className="gap-1.5 text-xs font-medium"
            >
              {solutionControls.isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Lightbulb className="size-3.5 text-warning" />
              )}
              {solutionControls.isLoading
                ? "Loading solution..."
                : "View solution"}
            </Button>
          ) : solutionControls.isVisible ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={solutionControls.onHide}
              className="gap-1.5 text-xs font-medium"
            >
              <EyeOff className="size-3.5" />
              Hide solution
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={solutionControls.onShow}
              className="gap-1.5 text-xs font-medium"
            >
              <Eye className="size-3.5" />
              Show solution
            </Button>
          )}
        </footer>
      )}
    </article>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import { Braces, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  QuestionCard,
  RichContent,
  type OptionKey,
  type QuestionMode,
} from "@/features/shared/components/question-card";
import { parseQuestionInput } from "./parseQuestionInput";

const SAMPLE_RICH_TEXT = String.raw`The quadratic formula is
$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}.$$

For water formation: $\ce{2H2 + O2 -> 2H2O}$.

OCR matrix sample:
$\begin{bmatrix}2x + 3y = 7 \ 4x - y = 5\end{bmatrix}$`;

const SAMPLE_INPUT = JSON.stringify(
  {
    questions: [
      {
        id: "rendering-sample",
        subject: "Physics",
        difficulty: "medium",
        questionText:
          "A body starts from rest and accelerates at $2\\,\\text{m/s}^2$. What is its speed after 3 seconds?",
        options: [
          { key: "A", content: "$3\\,\\text{m/s}$" },
          { key: "B", content: "$6\\,\\text{m/s}$" },
          { key: "C", content: "$9\\,\\text{m/s}$" },
          { key: "D", content: "$12\\,\\text{m/s}$" },
        ],
        correctOption: "B",
        explanation: "Use $v = u + at = 0 + (2)(3) = 6\\,\\text{m/s}$.",
        marks: 1,
        negativeMarks: 0.25,
      },
    ],
  },
  null,
  2,
);

export function QuestionRenderingPlayground() {
  const [input, setInput] = useState(SAMPLE_INPUT);
  const [richText, setRichText] = useState(SAMPLE_RICH_TEXT);
  const [shouldRepairRowsAndColumns, setShouldRepairRowsAndColumns] =
    useState(false);
  const [mode, setMode] = useState<QuestionMode>("exam");
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, OptionKey | null>
  >({});
  const result = useMemo(() => parseQuestionInput(input), [input]);

  useEffect(() => {
    setSelectedAnswers({});
  }, [input]);

  const isEmpty = result.format === "empty";

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.9fr)_minmax(0,1.1fr)]">
        <section className="flex min-h-128 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <Braces className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Input</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                {result.format === "empty"
                  ? "READY"
                  : result.format.toUpperCase()}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setInput(SAMPLE_INPUT)}
                className="gap-1.5"
              >
                <RotateCcw className="size-3.5" />
                Sample
              </Button>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3 p-4">
            <label htmlFor="question-rendering-input" className="sr-only">
              Question JSON or plain text
            </label>
            <Textarea
              id="question-rendering-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={`Paste question JSON or plain text…\n\n{"questionText":"...","options":["...","..."]}`}
              spellCheck={false}
              className="min-h-96 flex-1 resize-y font-mono text-xs leading-relaxed"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Paste plain text, one question object, an array, or a response
              containing <code>questions</code>, <code>results</code>, or{" "}
              <code>data</code>. Markdown and LaTeX use the same renderer as the
              test cards.
            </p>
          </div>
        </section>

        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Rendered preview</h2>
              <p className="text-xs text-muted-foreground">
                {result.questions.length}{" "}
                {result.questions.length === 1 ? "question" : "questions"}
              </p>
            </div>
            <div
              className="inline-flex rounded-lg bg-muted p-1"
              role="group"
              aria-label="Preview mode"
            >
              {(["exam", "review"] as const).map((nextMode) => (
                <Button
                  key={nextMode}
                  type="button"
                  size="sm"
                  variant={mode === nextMode ? "secondary" : "ghost"}
                  aria-pressed={mode === nextMode}
                  onClick={() => setMode(nextMode)}
                  className="capitalize"
                >
                  {nextMode}
                </Button>
              ))}
            </div>
          </div>

          {result.error ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
            >
              <p className="text-sm font-semibold text-destructive">
                Invalid JSON
              </p>
              <p className="mt-1 wrap-break-word font-mono text-xs text-muted-foreground">
                {result.error}
              </p>
            </div>
          ) : isEmpty ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Paste text or JSON to see the question rendering.
            </div>
          ) : result.questions.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              This JSON response does not contain any questions to render.
            </div>
          ) : (
            <div className="space-y-4">
              {result.questions.map((question, index) => (
                <QuestionCard
                  key={`${question.id}-${index}`}
                  question={question}
                  questionNumber={index + 1}
                  mode={mode}
                  selectedAnswer={selectedAnswers[question.id] ?? null}
                  onAnswerChange={(answer) =>
                    setSelectedAnswers((current) => ({
                      ...current,
                      [question.id]: answer,
                    }))
                  }
                  showActions={false}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Rich text / LaTeX preview</h2>
            <p className="text-xs text-muted-foreground">
              Test raw OCR text with the shared Markdown, KaTeX, and chemistry
              renderer.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={shouldRepairRowsAndColumns}
                onChange={(event) =>
                  setShouldRepairRowsAndColumns(event.target.checked)
                }
                className="size-4 accent-primary"
              />
              Repair matrix rows and columns
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRichText(SAMPLE_RICH_TEXT)}
              className="gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              Sample
            </Button>
          </div>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="rich-content-rendering-input"
              className="text-xs font-medium text-muted-foreground"
            >
              Raw text
            </label>
            <Textarea
              id="rich-content-rendering-input"
              value={richText}
              onChange={(event) => setRichText(event.target.value)}
              placeholder="Paste raw OCR text, Markdown, or LaTeX here…"
              spellCheck={false}
              className="min-h-48 resize-y font-mono text-xs leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              Wrap inline math in <code>$...$</code> and display math in{" "}
              <code>$$...$$</code>. Matrix row/column repair is opt-in because
              it changes repeated separators.
            </p>
          </div>

          <div className="min-h-48 rounded-xl border bg-background p-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground">
              Rendered output
            </p>
            {richText.trim() ? (
              <RichContent
                text={richText}
                className="text-sm leading-relaxed"
                normalizeOptions={{ shouldRepairRowsAndColumns }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Paste text or LaTeX to preview it here.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

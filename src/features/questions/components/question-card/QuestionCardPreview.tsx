"use client";

import { useState } from "react";
import { QuestionCard } from "@/features/questions/components/question-card";
import type {
  QuestionCardType,
  OptionKey,
  QuestionMode,
} from "@/features/questions/components/question-card";

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_QUESTIONS: QuestionCardType[] = [
  {
    id: "q-physics-001",
    subject: "physics",
    questionText:
      "A body of mass $m$ is thrown vertically upward with velocity $v$. The height at which the kinetic energy is equal to half the initial kinetic energy is:\n\n$$KE = \\frac{1}{2}mv^2$$",
    options: [
      { key: "A", content: "$\\dfrac{v^2}{2g}$" },
      { key: "B", content: "$\\dfrac{v^2}{4g}$" },
      { key: "C", content: "$\\dfrac{v^2}{8g}$" },
      { key: "D", content: "$\\dfrac{3v^2}{4g}$" },
    ],
    correctOption: "B",
    explanation:
      "At height $h$, kinetic energy $= \\frac{1}{2}mv'^2$ where $v'^2 = v^2 - 2gh$.\n\nSetting $\\frac{1}{2}mv'^2 = \\frac{1}{2} \\cdot \\frac{1}{2}mv^2$:\n\n$$v^2 - 2gh = \\frac{v^2}{2} \\implies h = \\frac{v^2}{4g}$$",
    marks: 4,
    negativeMarks: 1,
    diagramUrl: null,
    solutionDiagramUrl: null,
  },
  {
    id: "q-chem-001",
    subject: "chemistry",
    questionText:
      "What is the correct balanced equation for the combustion of ethanol?\n\nConsider $\ce{C2H5OH}$ reacting with excess $\ce{O2}$.",
    options: [
      {
        key: "A",
        content: "$\ce{C2H5OH + 3O2 -> 2CO2 + 3H2O}$",
      },
      {
        key: "B",
        content: "\ce{C2H5OH + 2O2 -> 2CO2 + 2H2O}",
      },
      {

        key: "C",
        content: "\ce{C2H5OH + O2 -> CO2 + H2O}",
      },
      {
        key: "D",
        content: "\ce{2C2H5OH + 5O2 -> 4CO2 + 6H2O}",
      },
    ],
    correctOption: "A",
    explanation:
      "Balancing the combustion of ethanol:\n\n\ce{C2H5OH + 3O2 -> 2CO2 + 3H2O}\n\n- Carbon: 2 = 2 ✓\n- Hydrogen: 6 = 6 ✓\n- Oxygen: 1 + 6 = 4 + 3 = 7 ✓",
    marks: 4,
    negativeMarks: 1,
    diagramUrl: null,
    solutionDiagramUrl: null,
  },
  {
    id: "q-chem-002",
    subject: "chemistry",
    questionText:
      "Select the balanced chemical equation from raw OCR output:\n\n\\ce{C2H5OH + 3O2 -> 2CO2 + 3H2O}",
    options: [
      { key: "A", content: "\\ce{C2H5OH + 3O2->2CO2 + 3H2O}" },
      { key: "B", content: "\\ce{C2H5OH + 2O2->2CO2 + 2H2O}" },
      { key: "C", content: "\\ce{C2H5OH + O2->CO2 + H2O}" },
      { key: "D", content: "\\ce{2C2H5OH + 5O2->4CO2 + 6H2O}" },
    ],
    correctOption: "A",
    explanation:
      "The equation \\ceC2H5OH+3O2->2CO2+3H2O is normalized automatically into valid chemical notation.",
    marks: 4,
    negativeMarks: 1,
    diagramUrl: null,
    solutionDiagramUrl: null,
  },
  {
    id: "q-math-001",
    subject: "mathematics",
    questionText:
      "If $f(x) = \\int_0^x \\frac{\\sin t}{t}\\,dt$, then $\\lim_{x \\to 0} \\dfrac{f(x)}{x}$ is equal to:",
    options: [
      { key: "A", content: "$0$" },
      { key: "B", content: "$1$" },
      { key: "C", content: "$\\dfrac{1}{2}$" },
      { key: "D", content: "Does not exist" },
    ],
    correctOption: "B",
    explanation:
      "By L'Hôpital's rule (or Leibniz rule for differentiation under the integral sign):\n\n$$\\lim_{x \\to 0} \\frac{f(x)}{x} = \\lim_{x \\to 0} \\frac{f'(x)}{1} = \\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$$",
    marks: 4,
    negativeMarks: 1,
    diagramUrl: null,
    solutionDiagramUrl: null,
  },
];

// ─── Preview Component ──────────────────────────────────────────────────────

export function QuestionCardPreview() {
  const [mode, setMode] = useState<QuestionMode>("exam");
  const [answers, setAnswers] = useState<Record<string, OptionKey | null>>({});

  const handleAnswerChange = (questionId: string, key: OptionKey) => {
    setAnswers((prev) => ({ ...prev, [questionId]: key }));
  };

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Mode:</span>
        <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
          <button
            type="button"
            onClick={() => setMode("exam")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${mode === "exam"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Exam Mode
          </button>
          <button
            type="button"
            onClick={() => setMode("review")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${mode === "review"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Review Mode
          </button>
        </div>
      </div>

      {/* Question cards */}
      {MOCK_QUESTIONS.map((q, index) => (
        <QuestionCard
          key={q.id}
          question={q}
          questionNumber={index + 1}
          mode={mode}
          selectedAnswer={answers[q.id] ?? null}
          onAnswerChange={(key) => handleAnswerChange(q.id, key)}
        />
      ))}
    </div>
  );
}

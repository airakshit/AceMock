"use client";

import { useState } from "react";
import { QuestionCard } from "@/features/questions/components/question-card";
import type {
  QuestionCardType,
  OptionKey,
  QuestionMode,
} from "@/features/questions/components/question-card";

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_QUESTIONS_OCR: QuestionCardType[] = [
  {
    id: "dskafjds",
    subject: "mathematics",
    questionText:
      "$\\left(\\dfrac{1 + \\cos\\dfrac{\\pi}{8} + i\\sin\\dfrac{\\pi}{8}}{1 + \\cos\\dfrac{\\pi}{8} - i\\sin\\dfrac{\\pi}{8}}\\right)^8 =$",
    options: [
      {
        key: "A",
        content: "$-1$",
      },
      {
        key: "B",
        content: "$1$",
      },
      {
        key: "C",
        content: "$i$",
      },
      {
        key: "D",
        content: "$-i$",
      },
    ],
    correctOption: "A",
  },
  {
    id: "q_7f3a91c2",
    subject: "physics",
    questionText:
      "The ratio of area within the orbit of electron for first excited state to ground state for Hydrogen atom is",
    options: [
      { key: "A", content: "$2:1$" },
      { key: "B", content: "$4:1$" },
      { key: "C", content: "$8:1$" },
      { key: "D", content: "$16:1$" },
    ],
    correctOption: "C",
    explanation: "N/A",
    marks: 1,
    negativeMarks: -1,
  },
  {
    id: "q_2b84e6d1",
    subject: "physics",
    questionText:
      "The position vector of a particle is $\\vec{r} = a\\\cos\\\omega t\\hat{i} + a\\sin\\omega t\\hat{j}$ then velocity of particle is",
    options: [
      { key: "A", content: "Parallel to position vector" },
      { key: "B", content: "Perpendicular to position vector" },
      { key: "C", content: "Directed towards origin" },
      { key: "D", content: "Directed away from origin" },
    ],
    correctOption: "B",
    explanation: "N/A",
    marks: 1,
    negativeMarks: -1,
  },
  {
    id: "q_91c5a7e3",
    subject: "physics",
    questionText:
      "A cable breaks if stretched by more than 2 mm. If it is cut into two equal parts then the elongation for which it can break is",
    options: [
      { key: "A", content: "0.25 mm" },
      { key: "B", content: "0.5 mm" },
      { key: "C", content: "1 mm" },
      { key: "D", content: "2 mm" },
    ],
    correctOption: "D",
    explanation: "N/A",
    marks: 1,
    negativeMarks: -1,
  },
  {
    id: "q_4d72f8b6",
    subject: "physics",
    questionText: "Beats are not noticed if difference in frequencies is",
    options: [
      { key: "A", content: "4" },
      { key: "B", content: "6" },
      { key: "C", content: "8" },
      { key: "D", content: "12" },
    ],
    correctOption: "A",
    explanation: "N/A",
    marks: 1,
    negativeMarks: -1,
  },
  {
    id: "q_a63e19f4",
    subject: "physics",
    questionText:
      "When distance between two charged particle is made one third then force between them will be",
    options: [
      { key: "A", content: "double" },
      { key: "B", content: "triple" },
      { key: "C", content: "four times" },
      { key: "D", content: "nine times" },
    ],
    correctOption: "D",
    explanation: "N/A",
    marks: 1,
    negativeMarks: -1,
  },
  {
    id: "q_38b5d2a7",
    subject: "physics",
    questionText:
      "The threshold wavelength of metal is $4000\\text{ \\AA}$ then light of wavelength $3000\\text{ \\AA}$ incident on metal then stopping potential will be",
    options: [
      { key: "A", content: "1.7 V" },
      { key: "B", content: "1.6 V" },
      { key: "C", content: "1.5 V" },
      { key: "D", content: "1 V" },
    ],
    correctOption: "A",
    explanation: "N/A",
    marks: 1,
    negativeMarks: -1,
  },
  {
    id: "q_e17a94c5",
    subject: "chemistry",
    questionText: "The correct order of first ionization potential is",
    options: [
      { key: "A", content: "$C > N > O$" },
      { key: "B", content: "$N > O > C$" },
      { key: "C", content: "$C < N < O$" },
      { key: "D", content: "$C > O > N$" },
    ],
    correctOption: "B",
    explanation: "N/A",
    marks: 1,
    negativeMarks: -1,
  },
  {
    id: "q_5c82f1d9",
    subject: "chemistry",
    questionText: "pH of $0.63\\\\%$ $\\\ce{HNO3}$ solution is",
    options: [
      { key: "A", content: "0" },
      { key: "B", content: "1" },
      { key: "C", content: "1.5" },
      { key: "D", content: "2.5" },
    ],
    correctOption: "B",
    explanation: "N/A",
    marks: 1,
    negativeMarks: -1,
  },
  {
    id: "q_b49d63e8",
    subject: "chemistry",
    questionText:
      "Dichromate ion is reduced using $\\ce{Fe^{2+}}$ ion. The number of electrons involved per Cr-atom is",
    options: [
      { key: "A", content: "1" },
      { key: "B", content: "5" },
      { key: "C", content: "3" },
      { key: "D", content: "4" },
    ],
    correctOption: "C",
    explanation: "N/A",
    marks: 1,
    negativeMarks: -1,
  },
  {
    id: "q_82f4c1a6",
    subject: "chemistry",
    questionText:
      "The number of spectral lines formed by returning of electron from $5^{\\\text{th}}$ energy level of H-atom is",
    options: [
      { key: "A", content: "10" },
      { key: "B", content: "8" },
      { key: "C", content: "6" },
      { key: "D", content: "4" },
    ],
    correctOption: "A",
    explanation: "N/A",
    marks: 1,
    negativeMarks: -1,
  },
  {
    id: "q_d71e35b9",
    subject: "chemistry",
    questionText: "Ionic compound dissolved in water when",
    options: [
      { key: "A", content: "Hydration energy < lattice energy" },
      { key: "B", content: "Hydration energy > lattice energy" },
      { key: "C", content: "Hydration energy = lattice energy" },
      { key: "D", content: "Can't be predicted by this method" },
    ],
    correctOption: "D",
    explanation: "N/A",
    marks: 1,
    negativeMarks: -1,
  },
  {
    id: "q_6a93e4f2",
    subject: "chemistry",
    questionText: "Hydrogen cannot be obtained by",
    options: [
      { key: "A", content: "$\\ce{Zn} + \\ce{NaOH}$" },
      { key: "B", content: "$\\ce{Mg} + \\ce{H2SO4}$" },
      { key: "C", content: "$\\ce{Zn} + \\\ce{HNO3}$" },
      { key: "D", content: "$\\ce{Mn} + \\ce{HNO3}$" },
    ],
    correctOption: "C",
    explanation: "N/A",
    marks: 1,
    negativeMarks: -1,
  },
  {
    id: "q_f25b78c3",
    subject: "chemistry",
    questionText: "With hot and conc. $\\\ce{NaOH}$, $\\\ce{Cl2}$ gives.",
    options: [
      { key: "A", content: "NaCl/O" },
      { key: "B", content: "NaCl/O2" },
      { key: "C", content: "NaCl/O3" },
      { key: "D", content: "NaCl/O4" },
    ],
    correctOption: "B",
    explanation: "N/A",
    marks: 1,
    negativeMarks: -1,
  },
  {
    id: "q_3e81a5d7",
    subject: "chemistry",
    questionText: "Pyrolusite is an ore of",
    options: [
      { key: "A", content: "$\\\ce{Mn}$" },
      { key: "B", content: "$\\\ce{Sn}$" },
      { key: "C", content: "$\\\ce{Au}$" },
      { key: "D", content: "$\\\ce{Pb}$" },
    ],
    correctOption: "A",
    explanation: "N/A",
    marks: 1,
    negativeMarks: -1,
  },
  {
    id: "q_c64f29b1",
    subject: "chemistry",
    questionText:
      "The reducing agent in Bessemer converter during extraction of copper is",
    options: [
      { key: "A", content: "$\\\ce{C}$" },
      { key: "B", content: "$\\\ce{Al}$" },
      { key: "C", content: "$\\\ce{Cu2O}$" },
      { key: "D", content: "$\\\ce{CO}$" },
    ],
    correctOption: "C",
    explanation: "N/A",
    marks: 1,
    negativeMarks: -1,
  },
  {
    id: "q_97d3b6e1",
    subject: "chemistry",
    questionText:
      "The process of coating zinc on iron articles by heating with zinc dust is",
    options: [
      { key: "A", content: "pickling" },
      { key: "B", content: "sherardising" },
      { key: "C", content: "annealing" },
      { key: "D", content: "tempering" },
    ],
    correctOption: "B",
    explanation: "N/A",
    marks: 1,
    negativeMarks: -1,
  },
  {
    id: "q_1a58e7c4",
    subject: "chemistry",
    questionText:
      "Following compounds $\\\ce{CH3CH2OCH2CH3}$ and $\\\ce{CH3CH2CH2OCH3}$ are",
    options: [
      { key: "A", content: "tautomers" },
      { key: "B", content: "metamers" },
      { key: "C", content: "position isomers" },
      { key: "D", content: "functional group isomers" },
    ],
    correctOption: "B",
    explanation: "N/A",
    marks: 1,
    negativeMarks: -1,
  },
];

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
        content: "\ce{Ag2S} > \ce{HgS} > \ce{CuS}",
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
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
              mode === "exam"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Exam Mode
          </button>
          <button
            type="button"
            onClick={() => setMode("review")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
              mode === "review"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Review Mode
          </button>
        </div>
      </div>

      {/* Question cards */}
      {MOCK_QUESTIONS_OCR.map((q, index) => (
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

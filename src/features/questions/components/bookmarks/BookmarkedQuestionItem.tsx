"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { QuestionCard } from "../../../shared/components/question-card/QuestionCard";
import type {
  OptionKey,
  QuestionCardType,
} from "../../../shared/components/question-card/types";
import { getQuestionSolutionAction } from "../../actions";
import type { BookmarkedQuestionProjection } from "../../dto/projections";
import type { GetQuestionSolutionResult } from "../../dto/results";

interface BookmarkedQuestionItemProps {
  item: BookmarkedQuestionProjection;
  questionNumber: number;
}

const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];

/**
 * One bookmarked question on the bookmarks page.
 *
 * Owns the per-question solution state:
 * - **Memory** (`solution`): preloaded from the page payload when the
 *   page was requested with `includeSolution: true`, otherwise fetched
 *   on demand by "View solution". Once in memory it is never re-fetched.
 * - **Visibility** (`isVisible`): "Hide solution" collapses the reveal
 *   without dropping the memory; "Show solution" restores it with no
 *   network request.
 *
 * Until a solution is both loaded and visible the card renders
 * exam-style (no correct option, no explanation).
 */
export function BookmarkedQuestionItem({
  item,
  questionNumber,
}: BookmarkedQuestionItemProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<OptionKey | null>(null);

  // Solution memory — seeded from the payload when the page was
  // requested with solutions loaded.
  const [solution, setSolution] = useState<GetQuestionSolutionResult | null>(
    () =>
      item.correctOption != null
        ? {
            questionId: item.id,
            correctOption: item.correctOption,
            solution: item.solution ?? null,
            solutionDiagramUrl: item.solutionDiagramUrl ?? null,
          }
        : null,
  );
  const [isVisible, setIsVisible] = useState(item.correctOption != null);
  const [isLoading, startSolutionTransition] = useTransition();

  const handleView = () => {
    // Memory hit — reveal without sending another request.
    if (solution) {
      setIsVisible(true);
      return;
    }
    if (isLoading) return;

    startSolutionTransition(async () => {
      const res = await getQuestionSolutionAction({ questionId: item.id });

      if (res.success) {
        setSolution(res.data);
        setIsVisible(true);
        if (!res.data.solution && !res.data.solutionDiagramUrl) {
          toast.info("Correct answer revealed — no written solution exists.");
        }
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const revealed = solution !== null && isVisible;

  const rawOptions = (
    Array.isArray(item.options) ? item.options : []
  ) as Array<{ key?: string; text?: string; content?: string }>;

  const formattedOptions = rawOptions.map((opt, idx) => {
    const key = (opt.key || OPTION_KEYS[idx] || "A") as OptionKey;
    return { key, content: opt.content || opt.text || "" };
  });

  const cardData: QuestionCardType = {
    id: item.id,
    subject: (item.subjectSlug || "general").toLowerCase(),
    difficulty: item.difficulty,
    questionText: item.question,
    options: formattedOptions,
    // Answer data only reaches the card while the solution is revealed —
    // hidden solutions stay in memory but render exam-style.
    correctOption: solution && isVisible ? solution.correctOption : undefined,
    explanation:
      solution && isVisible ? (solution.solution ?? undefined) : undefined,
    marks: item.marks,
    diagramUrl: item.questionDiagram,
    solutionDiagramUrl:
      solution && isVisible
        ? (solution.solutionDiagramUrl ?? undefined)
        : undefined,
  };

  const bookmarkedOn = new Date(item.bookmarkedAt);

  return (
    <div className="space-y-2">
      {/* Curriculum context + bookmark metadata */}
      <div className="flex flex-col gap-1 px-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 font-medium">
          <span className="text-foreground">{item.subjectName}</span>
          {item.sectionName && (
            <>
              <span className="opacity-40">/</span>
              <span>{item.sectionName}</span>
            </>
          )}
          {item.chapterName && (
            <>
              <span className="opacity-40">/</span>
              <span className="font-semibold text-primary">
                {item.chapterName}
              </span>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 text-[11px]">
          <span>
            Bookmarked{" "}
            {bookmarkedOn.toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          <span aria-hidden="true">•</span>
          <span className={item.hasSolution ? "" : "italic opacity-75"}>
            {item.hasSolution ? "Solution available" : "Solution: N/A"}
          </span>
        </div>
      </div>

      <QuestionCard
        question={cardData}
        questionNumber={questionNumber}
        mode={revealed ? "review" : "exam"}
        selectedAnswer={selectedAnswer}
        onAnswerChange={setSelectedAnswer}
        // Every item on this page is bookmarked by definition — render the
        // button already-bookmarked and never re-send the create request.
        isBookmarked
        solutionControls={{
          isLoaded: solution !== null,
          isVisible: revealed,
          isLoading,
          onView: handleView,
          onHide: () => setIsVisible(false),
          onShow: () => setIsVisible(true),
        }}
      />
    </div>
  );
}

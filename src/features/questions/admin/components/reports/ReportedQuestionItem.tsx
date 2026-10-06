"use client";

import { Copy, Flag, MessageSquareText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { QuestionCard } from "../../../../shared/components/question-card";
import type {
  OptionKey,
  QuestionCardType,
} from "../../../../shared/components/question-card/types";
import { QUESTION_REPORT_OPTIONS } from "../../../../shared/components/question-card/types";
import type { ReportedQuestionProjection } from "../../../dto/projections";

/** Human labels for the enum values, sourced from the shared report menu. */
const REPORT_LABELS = new Map(
  QUESTION_REPORT_OPTIONS.map((option) => [option.value, option.label]),
);

const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];

/** The card is fully controlled and the admin is not answering — nothing to record. */
const NOOP = () => {};

interface ReportedQuestionItemProps {
  item: ReportedQuestionProjection;
  questionNumber: number;
}

/**
 * One reported question on `/admin/questions/reports`.
 *
 * The existing `QuestionCard` is rendered **unmodified** — every piece of
 * report-specific chrome lives in the wrapper above it:
 *
 * - a report header carrying category badges, report/reporter counts, the
 *   latest report time, and the most recent free-text detail;
 * - a "Copy ID" action so the admin can jump straight to the question in
 *   the authoring views that search by id;
 * - the section/chapter breadcrumb, because the card only surfaces the
 *   subject.
 *
 * The card is rendered in `review` mode with no selected answer, so the
 * correct option is highlighted green and — because the page is admin-only
 * and always receives the answer — the written solution and solution
 * diagram are passed in directly rather than fetched on demand. No
 * `solutionControls` are supplied on purpose: the card's own footer is
 * bookmark-scoped, and omitting it keeps this page from showing its
 * "N/A" placeholder for questions that simply have no solution.
 */
export function ReportedQuestionItem({
  item,
  questionNumber,
}: ReportedQuestionItemProps) {
  const rawOptions = (
    Array.isArray(item.options) ? item.options : []
  ) as Array<{ key?: string; text?: string; content?: string }>;

  const formattedOptions = rawOptions.map((opt, idx) => {
    const key = (opt.key || OPTION_KEYS[idx] || "A") as OptionKey;
    return { key, content: opt.content || opt.text || "" };
  });

  const cardData: QuestionCardType = {
    id: item.questionId,
    subject: (item.subjectSlug || "general").toLowerCase(),
    difficulty: item.difficulty,
    questionText: item.question,
    options: formattedOptions,
    correctOption: item.correctOption,
    // The reported answer is the point of the page — always revealed.
    explanation: item.hasSolution ? (item.solution ?? undefined) : undefined,
    marks: item.marks,
    diagramUrl: item.questionDiagramUrl,
    solutionDiagramUrl: item.hasSolution
      ? (item.solutionDiagramUrl ?? undefined)
      : undefined,
  };

  const latestReport = new Date(item.latestReportAt);
  // Newest category first, so the first detail found is the freshest.
  const detail = item.reports.find((report) => report.latestDescription);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(item.questionId);
      toast.success("Question ID copied.");
    } catch {
      toast.error("Could not copy the question ID.");
    }
  };

  return (
    <article className="space-y-2">
      {/* ─── Report context — everything the card itself doesn't say ─── */}
      <div className="rounded-xl border border-border/80 bg-card p-3 shadow-card sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                <Flag className="size-3.5 text-danger" aria-hidden="true" />
                {item.reportCount} report{item.reportCount === 1 ? "" : "s"}
              </span>
              <span aria-hidden="true" className="text-border">
                ·
              </span>
              <span className="text-muted-foreground">
                {item.reporterCount} reporter
                {item.reporterCount === 1 ? "" : "s"}
              </span>
            </div>

            {/* Category badges, one per distinct report type */}
            <div className="flex flex-wrap gap-1.5">
              {item.reports.map((report) => (
                <span
                  key={report.reportType}
                  className="inline-flex items-center gap-1 rounded-md border border-danger/30 bg-danger/10 px-1.5 py-0.5 text-[11px] font-medium text-danger"
                >
                  {REPORT_LABELS.get(report.reportType) ?? report.reportType}
                  <span className="rounded-sm bg-danger/15 px-1 font-mono tabular-nums">
                    {report.count}
                  </span>
                </span>
              ))}
            </div>

            {detail?.latestDescription && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <MessageSquareText
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="min-w-0 break-words">
                  &ldquo;{detail.latestDescription}&rdquo;
                  <span className="text-muted-foreground/70">
                    {" "}
                    —{" "}
                    {REPORT_LABELS.get(detail.reportType) ?? detail.reportType}
                  </span>
                </span>
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <time
              dateTime={latestReport.toISOString()}
              className="text-[11px] whitespace-nowrap text-muted-foreground"
            >
              {latestReport.toLocaleString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyId}
              className="h-7 gap-1 px-2 text-[11px]"
              aria-label="Copy question ID"
            >
              <Copy className="size-3" aria-hidden="true" />
              Copy ID
            </Button>
          </div>
        </div>

        {/* Section / chapter — the card only surfaces the subject */}
        {(item.sectionName || item.chapterName) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            {item.sectionName && <span>{item.sectionName}</span>}
            {item.sectionName && item.chapterName && (
              <span aria-hidden="true" className="opacity-40">
                /
              </span>
            )}
            {item.chapterName && (
              <span className="font-medium text-primary">
                {item.chapterName}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ─── The prebuilt card, untouched ─── */}
      <QuestionCard
        question={cardData}
        questionNumber={questionNumber}
        mode="review"
        selectedAnswer={null}
        onAnswerChange={NOOP}
      />
    </article>
  );
}

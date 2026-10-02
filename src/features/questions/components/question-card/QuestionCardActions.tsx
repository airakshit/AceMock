"use client";

import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, Check, Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createQuestionBookmarkAction,
  removeQuestionBookmarkAction,
  reportQuestionAction,
} from "../../actions";
import { QUESTION_REPORT_OPTIONS } from "../../types";
import type { QuestionReportType } from "../../types";

interface QuestionCardActionsProps {
  questionId: string;
  className?: string;
}

/**
 * Bookmark and report controls rendered in the QuestionCard header.
 *
 * - Bookmark toggles through the create/remove server actions; state only
 *   flips after a successful response (with toasts for feedback).
 * - Report opens a menu built from `QUESTION_REPORT_OPTIONS` (the
 *   `question_report_type_enum` values) — every option is shown with its
 *   label and description. Options already reported for this question are
 *   checkmarked and disabled; the server stays idempotent regardless.
 */
export function QuestionCardActions({
  questionId,
  className,
}: QuestionCardActionsProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [reportedTypes, setReportedTypes] = useState<QuestionReportType[]>([]);
  const [isBookmarkPending, startBookmarkTransition] = useTransition();
  const [isReportPending, startReportTransition] = useTransition();

  const handleToggleBookmark = () => {
    if (isBookmarkPending) return;

    startBookmarkTransition(async () => {
      if (isBookmarked) {
        const res = await removeQuestionBookmarkAction({ questionId });
        if (res.success) {
          setIsBookmarked(false);
          toast.success("Bookmark removed.");
        } else {
          toast.error(res.error.message);
        }
        return;
      }

      const res = await createQuestionBookmarkAction({ questionId });
      if (res.success) {
        setIsBookmarked(true);
        toast.success(
          res.data.alreadyBookmarked
            ? "Question is already bookmarked."
            : "Question bookmarked for later.",
        );
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleReport = (reportType: QuestionReportType) => {
    if (isReportPending || reportedTypes.includes(reportType)) return;

    startReportTransition(async () => {
      const res = await reportQuestionAction({ questionId, reportType });
      if (res.success) {
        setReportedTypes((prev) => [...prev, reportType]);
        toast.success(
          res.data.alreadyReported
            ? "You already reported this issue for this question."
            : "Report submitted. Thank you!",
        );
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const hasReported = reportedTypes.length > 0;

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {/* ─── Bookmark ─── */}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleToggleBookmark}
        disabled={isBookmarkPending}
        aria-pressed={isBookmarked}
        aria-label={isBookmarked ? "Remove bookmark" : "Bookmark question"}
        title={isBookmarked ? "Remove bookmark" : "Bookmark question"}
        className={cn(
          "text-muted-foreground hover:text-foreground",
          isBookmarked && "text-amber-500 hover:text-amber-600",
        )}
      >
        {isBookmarkPending ? (
          <Loader2 className="animate-spin" />
        ) : isBookmarked ? (
          <BookmarkCheck />
        ) : (
          <Bookmark />
        )}
      </Button>

      {/* ─── Report ─── */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isReportPending}
              aria-label="Report this question"
              title="Report this question"
              className={cn(
                "text-muted-foreground hover:text-foreground",
                hasReported && "text-red-500 hover:text-red-600",
              )}
            />
          }
        >
          {isReportPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Flag />
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={6} className="w-80">
          {/* GroupLabel must live inside a Group in Base UI */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2 py-1.5 font-semibold">
              Report this question
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />

          {QUESTION_REPORT_OPTIONS.map((option) => {
            const alreadyReported = reportedTypes.includes(option.value);

            return (
              <DropdownMenuItem
                key={option.value}
                disabled={alreadyReported || isReportPending}
                onClick={() => handleReport(option.value)}
                className="items-start gap-2"
              >
                <span className="flex min-w-0 flex-col gap-0.5 py-0.5">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {option.label}
                    {alreadyReported && (
                      <Check
                        className="size-3.5 text-emerald-500"
                        aria-label="Already reported"
                      />
                    )}
                  </span>
                  <span className="text-xs leading-snug text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

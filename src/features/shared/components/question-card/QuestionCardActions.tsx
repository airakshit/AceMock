"use client";

import { useTransition } from "react";
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
} from "../../../questions/actions";
import { QUESTION_REPORT_OPTIONS, type QuestionReportType } from "./types";
import { useQuestionInteractions } from "./QuestionInteractionsContext";

interface QuestionCardActionsProps {
  questionId: string;
  /**
   * Initial bookmark state of the question. Used only as a fallback
   * when the question hasn't been seen before in this session.
   */
  isBookmarked?: boolean;
  className?: string;
}

/**
 * Bookmark and report controls rendered in the QuestionCard header.
 *
 * State is persisted per questionId via QuestionInteractionsContext,
 * so navigating away and back preserves the user's actions.
 *
 * - Bookmark toggles through create/remove server actions.
 * - Report opens a menu from QUESTION_REPORT_OPTIONS.
 * - Both states persist across navigation.
 */
export function QuestionCardActions({
  questionId,
  isBookmarked: initialBookmarked = false,
  className,
}: QuestionCardActionsProps) {
  const { isBookmarked, setBookmarked, reportedTypes, addReport, hasReported } =
    useQuestionInteractions(questionId, initialBookmarked);

  // Type assertion to ensure setBookmarked accepts boolean only
  const setBookmarkedLocal = setBookmarked as (value: boolean) => void;

  const [isBookmarkPending, startBookmarkTransition] = useTransition();
  const [isReportPending, startReportTransition] = useTransition();

  const handleToggleBookmark = () => {
    if (isBookmarkPending) return;

    startBookmarkTransition(async () => {
      let res;
      if (isBookmarked) {
        // Remove bookmark
        res = await removeQuestionBookmarkAction({ questionId });
        if (res.success) {
          setBookmarkedLocal(false);
          toast.success("Bookmark removed.");
        } else {
          toast.error(res.error.message);
        }
      } else {
        // Add bookmark
        res = await createQuestionBookmarkAction({ questionId });
        if (res.success) {
          setBookmarkedLocal(true);
          toast.success(
            res.data.alreadyBookmarked
              ? "Question is already bookmarked."
              : "Question bookmarked for later.",
          );
        } else {
          toast.error(res.error.message);
        }
      }
    });
  };

  const handleReport = (reportType: QuestionReportType) => {
    if (isReportPending || reportedTypes.includes(reportType)) return;

    startReportTransition(async () => {
      const res = await reportQuestionAction({ questionId, reportType });
      if (res.success) {
        addReport(reportType);
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

  // Shared icon button classes (matching ghost variant icon-sm)
  const iconButtonClasses = cn(
    "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
    "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
  );

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
        <DropdownMenuTrigger className={iconButtonClasses}>
          {isReportPending ? <Loader2 className="animate-spin" /> : <Flag />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-80">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2 py-1.5 font-semibold">
              Report this question
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />

          {QUESTION_REPORT_OPTIONS.map((option) => {
            const alreadyReported = hasReported(option.value);

            return (
              <DropdownMenuItem
                key={option.value}
                disabled={alreadyReported}
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

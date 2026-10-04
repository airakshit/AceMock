"use client";

import { AlertTriangle, Flag, Loader2, Send } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FinishAttemptDialogProps {
  open: boolean;
  /** True while the submit request is in flight. */
  isFinishing: boolean;
  totalQuestions: number;
  answeredCount: number;
  /** 1-based positions of questions with no saved answer. */
  unansweredNumbers: number[];
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation shown before finishing an attempt. Highlights unanswered
 * questions so examinees can go back instead of submitting by accident.
 */
export function FinishAttemptDialog({
  open,
  isFinishing,
  totalQuestions,
  answeredCount,
  unansweredNumbers,
  onConfirm,
  onCancel,
}: FinishAttemptDialogProps) {
  const unansweredCount = unansweredNumbers.length;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isFinishing) onCancel();
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <span className="mx-auto mb-1 inline-flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary sm:mx-0">
            <Flag className="size-5" />
          </span>
          <AlertDialogTitle>Submit your test?</AlertDialogTitle>
          <AlertDialogDescription>
            You have answered{" "}
            <strong className="font-semibold text-foreground">
              {answeredCount} of {totalQuestions}
            </strong>{" "}
            questions.
            {unansweredCount > 0
              ? ` ${unansweredCount} ${
                  unansweredCount === 1 ? "question is" : "questions are"
                } still unanswered.`
              : " Every question has a saved answer."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {unansweredCount > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3.5 shrink-0" />
              Unanswered questions
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {unansweredNumbers.map((num) => (
                <span
                  key={num}
                  className="flex size-6 items-center justify-center rounded-md border border-amber-500/40 bg-background/60 text-[11px] font-semibold tabular-nums text-foreground"
                >
                  {num}
                </span>
              ))}
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isFinishing} onClick={onCancel}>
            Continue test
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isFinishing}
            onClick={(event) => {
              // Keep the dialog open while the request is in flight.
              event.preventDefault();
              onConfirm();
            }}
            className="gap-1.5"
          >
            {isFinishing ? (
              <>
                <Loader2 className="animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send />
                Submit test
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

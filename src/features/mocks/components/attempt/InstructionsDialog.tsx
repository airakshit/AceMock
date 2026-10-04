"use client";

import {
  ArrowRight,
  ListChecks,
  Loader2,
  MinusCircle,
  Percent,
  Repeat2,
  Timer,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buildInstructions, formatDuration, InstructionKey } from "./instructions";
import type { MockTestAttemptMeta } from "./types";

const instructionIcons: Record<
  InstructionKey,
  React.ComponentType<{ className?: string }>
> = {
  negative: Percent,
  options: ListChecks,
  partial: MinusCircle,
  attempts: Repeat2,
  timer: Timer,
};

interface InstructionsDialogProps {
  mockTest: MockTestAttemptMeta;
  open: boolean;
  /** True while the attempt is being created (Confirm clicked). */
  isStarting: boolean;
  onConfirm: () => void;
  /** Called when the user dismisses the dialog (should leave the page). */
  onDismiss: () => void;
}

export function InstructionsDialog({
  mockTest,
  open,
  isStarting,
  onConfirm,
  onDismiss,
}: InstructionsDialogProps) {
  const instructions = buildInstructions(mockTest);

  const stats = [
    { label: "Questions", value: String(mockTest.totalQuestions) },
    { label: "Total marks", value: String(mockTest.totalMarks) },
    {
      label: "Duration",
      value: mockTest.allowUntimed
        ? "Untimed"
        : formatDuration(mockTest.durationSeconds),
    },
    {
      label: "Negative marking",
      value:
        mockTest.negativePercentagePerQuestion > 0
          ? `-${mockTest.negativePercentagePerQuestion}%`
          : "None",
    },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isStarting) onDismiss();
      }}
    >
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden border-border/80 p-0 shadow-xl sm:max-w-2xl">
        {/* Header */}
        <DialogHeader className="gap-0 border-b border-border/80 px-6 pt-6 pb-5">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">
            Examination instructions
          </p>
          <DialogTitle className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
            {mockTest.name}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Review the test configuration and rules below, then confirm to begin.
          </DialogDescription>

          {/* Test configuration */}
          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border/80 bg-border/80 sm:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="bg-card px-3.5 py-3 text-left"
              >
                <dt className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  {stat.label}
                </dt>
                <dd className="mt-1 text-lg leading-none font-semibold text-foreground tabular-nums">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </DialogHeader>

        {/* Rules */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <p className="mb-3 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Rules
          </p>

          <ol className="divide-y divide-border/70 rounded-lg border border-border/80">
            {instructions.map((item, index) => {
              const Icon = instructionIcons[item.key];

              return (
                <li key={item.key} className="flex items-start gap-4 bg-card px-4 py-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/60 text-xs font-bold text-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      <Icon className="size-3" />
                      {item.key === "negative" && "Negative marking"}
                      {item.key === "options" && "Single correct option"}
                      {item.key === "partial" && "Skipping"}
                      {item.key === "attempts" && "Attempts"}
                      {item.key === "timer" &&
                        (mockTest.allowUntimed
                          ? "Time limit"
                          : "Auto submission")}
                    </p>
                    <p className="mt-1 text-[15px] leading-relaxed font-medium text-foreground">
                      {item.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Footer */}
        <DialogFooter className="mx-0 mb-0 border-t border-border/80 bg-muted/40 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onDismiss}
            disabled={isStarting}
            className="h-9 w-full text-sm sm:w-auto"
          >
            Back to tests
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isStarting}
            className="h-9 w-full gap-1.5 text-sm sm:w-auto"
          >
            {isStarting ? (
              <>
                <Loader2 className="animate-spin" />
                Preparing test...
              </>
            ) : (
              <>
                Confirm &amp; Start
                <ArrowRight />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

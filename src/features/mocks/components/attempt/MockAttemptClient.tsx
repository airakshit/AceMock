"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlarmClock,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutGrid,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { startMockAttemptAction } from "../../actions/start-mock-attempt";
import { submitAttemptAnswerAction } from "../../actions/submit-attempt-answer";
import { completeMockAttemptAction } from "../../actions/complete-mock-attempt";
import type { StartMockAttemptResult } from "../../dto/results";
import { FinishAttemptDialog } from "./FinishAttemptDialog";
import { formatClock } from "./instructions";
import { InstructionsDialog } from "./InstructionsDialog";
import { QuestionCard as QuestionsQuestionCard } from "@/features/shared/components/question-card/QuestionCard";
import type {
  QuestionCardType,
  OptionKey,
  QuestionMode,
  PassageType,
} from "@/features/shared/components/question-card/types";
import { QuestionPalette } from "./QuestionPalette";
import { resetQuestionScroll } from "./question-scroll";
import type { AttemptPhase, FinishReason, MockTestAttemptMeta } from "./types";
import { useAttemptTimer } from "./use-attempt-timer";

interface MockAttemptClientProps {
  mockTest: MockTestAttemptMeta;
}

export function MockAttemptClient({ mockTest }: MockAttemptClientProps) {
  const router = useRouter();

  const [phase, setPhase] = useState<AttemptPhase>("instructions");
  const [session, setSession] = useState<StartMockAttemptResult | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, OptionKey>>({});
  const [pendingOption, setPendingOption] = useState<OptionKey | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isFinishOpen, setIsFinishOpen] = useState(false);
  const [finishReason, setFinishReason] = useState<FinishReason>("manual");
  // Wall-clock moment the attempt was submitted — the summary's "time used"
  // for an untimed test. Captured here (an event handler) so render stays pure.
  const [finishedAtMs, setFinishedAtMs] = useState<number | null>(null);

  // Guards against double-submission (manual + timer racing together).
  const finishStartedRef = useRef(false);
  const questionAreaRef = useRef<HTMLDivElement | null>(null);
  // Background save chains, keyed by questionId, so repeated submissions for
  // the same question never race each other on the server.
  const saveChainsRef = useRef<Map<string, Promise<void>>>(new Map());

  const questions = useMemo(
    () => session?.questions.questions ?? [],
    [session],
  );
  const isExamLive = phase === "exam" || phase === "finishing";
  const isStarting = phase === "starting";
  const isFinishing = phase === "finishing";

  const currentQuestion = questions[currentIndex] ?? null;

  const positionByQuestionId = useMemo(
    () => new Map(questions.map((q) => [q.questionId, q.position])),
    [questions],
  );

  const passageById = useMemo(
    () =>
      new Map(
        (session?.questions.passages ?? []).map((passage) => [
          passage.id,
          passage,
        ]),
      ),
    [session],
  );

  const answeredCount = useMemo(
    () => questions.filter((q) => Boolean(selections[q.questionId])).length,
    [questions, selections],
  );

  const unansweredNumbers = useMemo(
    () =>
      questions.filter((q) => !selections[q.questionId]).map((q) => q.position),
    [questions, selections],
  );

  const currentPassage = currentQuestion?.passageId
    ? (passageById.get(currentQuestion.passageId) ?? null)
    : null;

  const passageQuestionPositions = currentPassage
    ? currentPassage.questionIds
        .map((id) => positionByQuestionId.get(id))
        .filter((pos): pos is number => pos !== undefined)
    : [];

  const savedOption = currentQuestion
    ? (selections[currentQuestion.questionId] ?? null)
    : null;
  const isAlreadySaved =
    pendingOption !== null && pendingOption === savedOption;
  const canConfirm =
    phase === "exam" && pendingOption !== null && !isAlreadySaved;

  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex >= questions.length - 1;

  // ------------------------------------------------------------------
  // Timer — deadline derived from attempt creation so refreshes resume
  // ------------------------------------------------------------------
  const handleTimeUp = () => {
    toast.warning("Time's up! Your test has been submitted automatically.");
    void handleFinish("time-up");
  };

  const remainingSeconds = useAttemptTimer({
    startedAt: session?.attempt.createdAt ?? null,
    durationSeconds: mockTest.durationSeconds,
    // An untimed test never arms the countdown — no expiry, no auto-submit.
    active: phase === "exam" && !mockTest.allowUntimed,
    onExpire: handleTimeUp,
  });

  const isLowTime =
    remainingSeconds !== null &&
    remainingSeconds <= 300 &&
    remainingSeconds > 60;
  const isCriticalTime =
    remainingSeconds !== null && remainingSeconds <= 60 && remainingSeconds > 0;

  // After navigation, glide the question back to the top — the question
  // column on desktop, the page on mobile — while the navigator stays put.
  // A no-op while already at the top.
  useEffect(() => {
    if (!isExamLive) return;
    resetQuestionScroll(questionAreaRef);
  }, [currentIndex, isExamLive]);

  // ------------------------------------------------------------------
  // Attempt lifecycle
  // ------------------------------------------------------------------
  const handleFinish = async (reason: FinishReason) => {
    if (!session || finishStartedRef.current) return;
    finishStartedRef.current = true;

    setFinishReason(reason);
    setPhase("finishing");

    try {
      // Let any in-flight answer submissions land before completing the
      // attempt — once completed, the server rejects further answers.
      await Promise.allSettled(Array.from(saveChainsRef.current.values()));

      const res = await completeMockAttemptAction({
        attemptId: session.attempt.id,
      });

      if (!res.success) {
        if (reason === "manual") {
          toast.error(
            res.error.message || "Could not submit your test. Please retry.",
          );
          finishStartedRef.current = false;
          setPhase("exam");
          return;
        }
        toast.error(
          "Your responses are saved, but marking the attempt as submitted failed.",
        );
      }
    } catch {
      if (reason === "manual") {
        toast.error("An unexpected error occurred while submitting.");
        finishStartedRef.current = false;
        setPhase("exam");
        return;
      }
    }

    setFinishedAtMs(Date.now());
    setPhase("finished");
  };

  const handleStart = async () => {
    setPhase("starting");

    try {
      const res = await startMockAttemptAction({ mockTestId: mockTest.id });

      if (!res.success) {
        toast.error(res.error.message || "Could not start the test.");
        setPhase("instructions");
        return;
      }

      if (res.data.questions.questions.length === 0) {
        toast.error("This test has no questions linked to it.");
        router.push("/mocks");
        return;
      }

      const savedSelections: Record<string, OptionKey> = {};
      for (const answer of res.data.answers) {
        savedSelections[answer.questionId] = answer.selectedOption;
      }

      finishStartedRef.current = false;
      setFinishedAtMs(null);
      saveChainsRef.current.clear();
      setSession(res.data);
      setSelections(savedSelections);
      setCurrentIndex(0);
      setPendingOption(null);
      setFinishReason("manual");
      setPhase("exam");

      if (res.data.answers.length > 0) {
        toast.info("Resumed your in-progress attempt.");
      }
    } catch {
      toast.error("An unexpected error occurred while starting the test.");
      setPhase("instructions");
    }
  };

  const revertOptimisticAnswer = (
    questionId: string,
    option: OptionKey,
    position: number,
  ) => {
    setSelections((prev) => {
      // A newer answer replaced this one — leave it alone.
      if (prev[questionId] !== option) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    toast.error(
      `Could not save your answer to Question ${position}. Please retry.`,
    );
  };

  /**
   * Sends one answer to the server. Never throws — failures roll back the
   * optimistic selection (only if nothing newer replaced it) and toast.
   */
  const runSave = async (
    attemptId: string,
    questionId: string,
    option: OptionKey,
    position: number,
  ) => {
    try {
      const res = await submitAttemptAnswerAction({
        attemptId,
        questionId,
        selectedOption: option,
      });

      if (!res.success) {
        revertOptimisticAnswer(questionId, option, position);
      }
    } catch {
      revertOptimisticAnswer(questionId, option, position);
    }
  };

  /**
   * Appends a save to the per-question chain so two rapid submissions for
   * the same question are executed one after another instead of racing.
   */
  const enqueueSave = (
    questionId: string,
    task: () => Promise<void>,
  ): Promise<void> => {
    const previous = saveChainsRef.current.get(questionId) ?? Promise.resolve();
    const next = previous.then(task).then(() => {
      if (saveChainsRef.current.get(questionId) === next) {
        saveChainsRef.current.delete(questionId);
      }
    });
    saveChainsRef.current.set(questionId, next);
    return next;
  };

  /**
   * Confirms the pending answer: commits it locally and moves to the next
   * question instantly, while the server write happens in the background —
   * no loading state is shown for this interaction.
   */
  const handleConfirmAnswer = () => {
    if (!session || !currentQuestion || !pendingOption || isAlreadySaved) {
      return;
    }

    const attemptId = session.attempt.id;
    const questionId = currentQuestion.questionId;
    const position = currentQuestion.position;
    const option = pendingOption;

    // Optimistic commit + instant navigation.
    setSelections((prev) => ({ ...prev, [questionId]: option }));
    setPendingOption(null);
    if (!isLastQuestion) {
      setCurrentIndex((prev) => prev + 1);
    }

    // Background server write.
    enqueueSave(questionId, () =>
      runSave(attemptId, questionId, option, position),
    );
  };

  /**
   * Advances to the next question. When an answer is selected it is
   * committed first (optimistic local commit + background server write);
   * with nothing selected the question is simply skipped — the server is
   * only ever hit for a real selection.
   */
  const handleNext = () => {
    if (canConfirm) {
      handleConfirmAnswer();
      return;
    }
    if (!isLastQuestion) {
      goToQuestion(currentIndex + 1);
    }
  };

  const goToQuestion = (index: number) => {
    if (index < 0 || index >= questions.length) return;
    setCurrentIndex(index);
    setPendingOption(null);
    setIsPaletteOpen(false);
  };

  // ------------------------------------------------------------------
  // Render: instructions / starting
  // ------------------------------------------------------------------
  if (phase === "instructions" || phase === "starting") {
    return (
      <div className="relative flex min-h-full flex-1 flex-col">
        {/* Static backdrop behind the instructions dialog */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardList className="size-6" />
          </span>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-foreground">
              {mockTest.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Review the instructions and confirm to begin your test.
            </p>
          </div>
        </div>

        <InstructionsDialog
          mockTest={mockTest}
          open
          isStarting={isStarting}
          onConfirm={handleStart}
          onDismiss={() => router.push("/mocks")}
        />
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Render: finished summary
  // ------------------------------------------------------------------
  if (phase === "finished") {
    const unansweredCount = unansweredNumbers.length;
    // Untimed attempts have no countdown, so "time used" is the real time
    // spent between starting and submitting.
    const startedAtMs = session?.attempt.createdAt
      ? new Date(session.attempt.createdAt).getTime()
      : null;
    const timeUsedSeconds = mockTest.allowUntimed
      ? startedAtMs !== null && finishedAtMs !== null
        ? Math.max(0, Math.floor((finishedAtMs - startedAtMs) / 1000))
        : 0
      : remainingSeconds !== null
        ? Math.max(0, mockTest.durationSeconds - remainingSeconds)
        : mockTest.durationSeconds;

    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md space-y-5 rounded-xl border border-border/80 bg-card p-6 text-center shadow-card">
          <span
            className={cn(
              "mx-auto flex size-14 items-center justify-center rounded-full",
              finishReason === "time-up"
                ? "bg-warning/10 text-warning"
                : "bg-success/10 text-success",
            )}
          >
            <CheckCircle2 className="size-7" />
          </span>

          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-foreground">
              {finishReason === "time-up"
                ? "Time's up — test submitted"
                : "Test submitted successfully"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {finishReason === "time-up"
                ? "Your responses were submitted automatically when the timer ran out."
                : "Your responses have been saved. Well done!"}
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border/60 bg-muted/30 px-2 py-2.5">
              <dd className="text-lg font-semibold text-success tabular-nums">
                {answeredCount}
              </dd>
              <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Answered
              </dt>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 px-2 py-2.5">
              <dd className="text-lg font-semibold text-foreground tabular-nums">
                {unansweredCount}
              </dd>
              <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Skipped
              </dt>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 px-2 py-2.5">
              <dd className="text-lg font-semibold text-foreground tabular-nums">
                {formatClock(timeUsedSeconds).replace(/^00:/, "")}
              </dd>
              <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Time used
              </dt>
            </div>
          </dl>

          <p className="text-xs text-muted-foreground">
            You can review your result once it is published by the admin.
          </p>

          <Button
            type="button"
            className="w-full gap-1.5"
            onClick={() => router.push("/mocks")}
          >
            Back to mock tests
            <ChevronRight />
          </Button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Render: live exam
  // ------------------------------------------------------------------
  const progressPercent =
    questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  return (
    <div className="flex min-h-full flex-1 flex-col lg:h-svh lg:min-h-0">
      {/* Top bar: identity + timer + submit */}
      <header className="sticky top-0 z-20 shrink-0 border-b border-border/80 bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-3 sm:px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Exit test — your attempt stays in progress"
            onClick={() => router.push("/mocks")}
          >
            <ArrowLeft />
          </Button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {mockTest.name}
            </p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              Question {currentIndex + 1} of {questions.length} ·{" "}
              {answeredCount} answered
            </p>
          </div>

          {/* Mobile question navigator trigger */}
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="lg:hidden"
            aria-label="Open question navigator"
            onClick={() => setIsPaletteOpen(true)}
          >
            <LayoutGrid />
          </Button>

          {/* Timer — an untimed test shows a static chip instead of a clock */}
          {mockTest.allowUntimed ? (
            <div
              title="No time limit"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-2 text-sm font-semibold text-muted-foreground"
            >
              <AlarmClock className="size-4" />
              <span>Untimed</span>
            </div>
          ) : (
            <div
              role="timer"
              aria-live="off"
              title="Time remaining"
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg border px-2 text-sm font-semibold tabular-nums transition-colors",
                isCriticalTime &&
                  "animate-pulse border-destructive/50 bg-destructive/10 text-destructive",
                isLowTime &&
                  "border-warning/50 bg-warning/10 text-warning",
                !isLowTime &&
                  !isCriticalTime &&
                  "border-border/70 bg-muted/40 text-foreground",
              )}
            >
              <AlarmClock className="size-4" />
              {formatClock(remainingSeconds ?? mockTest.durationSeconds)}
            </div>
          )}

          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setIsFinishOpen(true)}
          >
            <Send />
            <span className="hidden sm:inline">Submit test</span>
            <span className="sm:hidden">Submit</span>
          </Button>
        </div>

        {/* Answered progress bar */}
        <div
          className="h-1 w-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={answeredCount}
        >
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Body: question column + navigator column, same top edge */}
      <div className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col gap-4 p-3 sm:p-4 lg:flex-row lg:gap-6 lg:p-6">
        <main
          ref={questionAreaRef}
          className="min-w-0 flex-1 space-y-4 scrollbar-subtle lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain"
        >
          {currentQuestion && (
            <QuestionsQuestionCard
              key={currentQuestion.questionId}
              question={{
                id: currentQuestion.questionId,
                subject: "General" as QuestionCardType["subject"],
                difficulty:
                  currentQuestion.difficulty as QuestionCardType["difficulty"],
                questionText: currentQuestion.question,
                options: currentQuestion.options.map((opt) => ({
                  key: opt.key.toUpperCase() as QuestionCardType["options"][number]["key"],
                  content: opt.text,
                })),
                marks: currentQuestion.marks,
                negativeMarks: undefined,
                diagramUrl: currentQuestion.questionDiagram ?? undefined,
                passage: currentPassage
                  ? {
                      id: currentPassage.id,
                      content: currentPassage.content,
                      questionPositions: passageQuestionPositions,
                    }
                  : null,
              }}
              questionNumber={currentIndex + 1}
              mode="exam"
              selectedAnswer={savedOption as OptionKey | null}
              pendingAnswer={pendingOption as OptionKey | null}
              onAnswerChange={(key) => {
                if (phase === "exam") setPendingOption(key);
              }}
              isBookmarked={false}
              className="shadow-none hover:shadow-none"
            />
          )}
        </main>

        <aside className="hidden min-h-0 w-72 shrink-0 lg:block">
          <div className="h-full overflow-y-auto overscroll-contain">
            <QuestionPalette
              questions={questions}
              selections={selections}
              currentIndex={currentIndex}
              onSelect={goToQuestion}
            />
          </div>
        </aside>
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 z-10 shrink-0 border-t border-border/80 bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-3 sm:px-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1 sm:h-8"
            disabled={isFirstQuestion || isFinishing}
            onClick={() => goToQuestion(currentIndex - 1)}
          >
            <ChevronLeft />
            <span className="hidden sm:inline">Prev</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 sm:h-8"
            disabled={isFinishing || (isLastQuestion && !canConfirm)}
            onClick={handleNext}
            title={
              canConfirm
                ? "Save the selected answer and go to the next question"
                : "Go to the next question without saving"
            }
          >
            Next
            <ChevronRight />
          </Button>
        </div>
      </div>

      {/* Mobile question navigator */}
      <Sheet open={isPaletteOpen} onOpenChange={setIsPaletteOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] gap-0 overflow-hidden p-0"
        >
          <SheetTitle className="sr-only">Question navigator</SheetTitle>
          <SheetDescription className="sr-only">
            Jump to any question in the test.
          </SheetDescription>
          <div className="max-h-[85dvh] overflow-y-auto p-4 pr-12">
            <QuestionPalette
              questions={questions}
              selections={selections}
              currentIndex={currentIndex}
              onSelect={goToQuestion}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Finish confirmation */}
      <FinishAttemptDialog
        open={isFinishOpen}
        isFinishing={isFinishing}
        totalQuestions={questions.length}
        answeredCount={answeredCount}
        unansweredNumbers={unansweredNumbers}
        onConfirm={() => handleFinish("manual")}
        onCancel={() => setIsFinishOpen(false)}
      />
    </div>
  );
}

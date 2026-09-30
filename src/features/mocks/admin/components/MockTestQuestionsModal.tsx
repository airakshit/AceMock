"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  HelpCircle,
  Clock,
  Award,
  Percent,
  CheckCircle2,
  FileText,
  AlertCircle,
  Loader2,
  BookOpen,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MockTestDetailsResult } from "../../dto/results";
import { getAdminMockTestDetailsAction } from "../../actions/get-admin-mock-test-details";

interface MockTestQuestionsModalProps {
  mockTestId: string | null;
  onClose: () => void;
}

export function MockTestQuestionsModal({
  mockTestId,
  onClose,
}: MockTestQuestionsModalProps) {
  const [details, setDetails] = useState<MockTestDetailsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!mockTestId) {
      setDetails(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    getAdminMockTestDetailsAction(mockTestId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setDetails(res.data);
        } else {
          toast.error(res.error.message || "Failed to load mock test details.");
          onClose();
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error("An error occurred while fetching mock test questions.");
        onClose();
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [mockTestId, onClose]);

  const open = Boolean(mockTestId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:max-w-4xl">
        <DialogHeader className="p-5 pb-3 border-b border-border/60">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="size-4" />
              </span>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground">
                  {details ? details.name : "Mock Test Questions"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Inspecting assembled questions and order sequence
                </DialogDescription>
              </div>
            </div>

            {details && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs font-medium border-border">
                  <Clock className="size-3 mr-1 text-muted-foreground" />
                  {Math.round(details.durationSeconds / 60)} mins
                </Badge>
                <Badge variant="outline" className="text-xs font-medium border-border">
                  <Award className="size-3 mr-1 text-muted-foreground" />
                  {details.totalMarks} Marks
                </Badge>
                <Badge variant="outline" className="text-xs font-medium border-border">
                  <Percent className="size-3 mr-1 text-muted-foreground" />
                  -{details.negativePercentagePerQuestion}% Penalty
                </Badge>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-xs font-medium">Loading examination questions...</p>
            </div>
          ) : !details ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Mock test details not found.
            </div>
          ) : details.questions.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No questions linked to this mock test.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
                <span>
                  Showing all <strong className="text-foreground">{details.questions.length}</strong> questions in sequence
                </span>
                {details.instructions && (
                  <span className="italic text-[11px] truncate max-w-sm">
                    Note: {details.instructions}
                  </span>
                )}
              </div>

              {details.questions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold text-foreground">
                        {q.position}
                      </span>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground leading-relaxed whitespace-pre-wrap">
                          {q.question}
                        </p>
                        {q.documentTitle && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <FileText className="size-3 shrink-0" />
                            <span>Source: {q.documentTitle}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] uppercase font-semibold tracking-wide ${
                          q.difficulty === "easy"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : q.difficulty === "hard"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {q.difficulty}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        {q.marks} {q.marks === 1 ? "Mark" : "Marks"}
                      </Badge>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt) => {
                      const isCorrect = opt.key.toUpperCase() === q.correctOption.toUpperCase();

                      return (
                        <div
                          key={opt.key}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                            isCorrect
                              ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200 font-medium"
                              : "border-border/60 bg-muted/20 text-muted-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`size-5 rounded flex items-center justify-center text-[10px] font-bold ${
                                isCorrect
                                  ? "bg-emerald-500 text-white"
                                  : "bg-muted text-muted-foreground border border-border/80"
                              }`}
                            >
                              {opt.key.toUpperCase()}
                            </span>
                            <span className="truncate">{opt.text}</span>
                          </div>

                          {isCorrect && (
                            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Solution or Hint */}
                  {(q.solution || q.hint) && (
                    <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground space-y-1 border border-border/40">
                      {q.hint && (
                        <div>
                          <strong className="text-foreground font-semibold">Hint: </strong>
                          {q.hint}
                        </div>
                      )}
                      {q.solution && (
                        <div>
                          <strong className="text-foreground font-semibold">Solution: </strong>
                          {q.solution}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

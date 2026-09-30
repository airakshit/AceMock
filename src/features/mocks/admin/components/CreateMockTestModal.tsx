"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Search,
  CheckCircle2,
  Clock,
  Percent,
  Award,
  Layers,
  Sparkles,
  Loader2,
  AlertCircle,
  HelpCircle,
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DocumentOptionForMockProjection } from "../../dto/projections";
import { getDocumentsForMockCreationAction } from "../../actions/get-documents-for-mock-creation";
import { createMockTestFromDocumentsAction } from "../../actions/create-mock-test-from-documents";

interface CreateMockTestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTestCreated: () => void;
}

const DURATION_PRESETS = [
  { label: "30 mins", value: 30 },
  { label: "45 mins", value: 45 },
  { label: "60 mins", value: 60 },
  { label: "90 mins", value: 90 },
  { label: "120 mins", value: 120 },
  { label: "180 mins", value: 180 },
];

const NEGATIVE_PRESETS = [
  { label: "0% (None)", value: 0 },
  { label: "20% (1/5th)", value: 20 },
  { label: "25% (1/4th)", value: 25 },
  { label: "33% (1/3rd)", value: 33 },
  { label: "50% (1/2)", value: 50 },
];

export function CreateMockTestModal({
  open,
  onOpenChange,
  onTestCreated,
}: CreateMockTestModalProps) {
  // Data loading state
  const [documents, setDocuments] = useState<DocumentOptionForMockProjection[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [searchDocQuery, setSearchDocQuery] = useState("");
  const [testName, setTestName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [negativePercentage, setNegativePercentage] = useState(25);
  const [instructions, setInstructions] = useState("");
  const [customTotalMarks, setCustomTotalMarks] = useState<string>("");

  // Load available documents when modal opens
  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    setIsLoadingDocs(true);

    getDocumentsForMockCreationAction()
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setDocuments(res.data);
        } else {
          toast.error(res.error.message || "Failed to load documents");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error("An error occurred while loading documents.");
      })
      .finally(() => {
        if (isMounted) setIsLoadingDocs(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open]);

  // Reset form when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedDocIds([]);
      setSearchDocQuery("");
      setTestName("");
      setDurationMinutes(60);
      setNegativePercentage(25);
      setInstructions("");
      setCustomTotalMarks("");
    }
    onOpenChange(newOpen);
  };

  // Filtered documents list
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) =>
      doc.title.toLowerCase().includes(searchDocQuery.toLowerCase().trim()),
    );
  }, [documents, searchDocQuery]);

  // Total questions from selected documents
  const totalSelectedQuestions = useMemo(() => {
    return documents
      .filter((doc) => selectedDocIds.includes(doc.id))
      .reduce((acc, doc) => acc + doc.questionCount, 0);
  }, [documents, selectedDocIds]);

  // Auto-generate name when documents are selected if name is blank or auto-derived
  const handleToggleDoc = (docId: string) => {
    setSelectedDocIds((prev) => {
      const next = prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId];

      // Auto-suggest name if empty
      if (next.length > 0 && !testName.trim()) {
        const picked = documents.filter((d) => next.includes(d.id));
        if (picked.length === 1) {
          setTestName(`${picked[0].title} Mock Test`);
        } else {
          setTestName(`Mock Test (${picked.length} Documents)`);
        }
      }
      return next;
    });
  };

  const handleSelectAllDocs = () => {
    const docsWithQuestions = filteredDocuments.filter((d) => d.questionCount > 0);
    const allIds = docsWithQuestions.map((d) => d.id);
    setSelectedDocIds(allIds);
    if (!testName.trim() && allIds.length > 0) {
      setTestName(`Comprehensive Mock Test (${allIds.length} Documents)`);
    }
  };

  const handleClearAllDocs = () => {
    setSelectedDocIds([]);
  };

  // Submit creation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!testName.trim()) {
      toast.error("Please enter a name for the mock test.");
      return;
    }

    if (selectedDocIds.length === 0) {
      toast.error("Please select at least one document.");
      return;
    }

    if (totalSelectedQuestions === 0) {
      toast.error("The selected document(s) do not have any extracted questions.");
      return;
    }

    if (durationMinutes <= 0) {
      toast.error("Please specify a valid test duration in minutes.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await createMockTestFromDocumentsAction({
        name: testName.trim(),
        documentIds: selectedDocIds,
        durationMinutes,
        negativePercentagePerQuestion: negativePercentage,
        instructions: instructions.trim() || undefined,
        customTotalMarks: customTotalMarks ? Number(customTotalMarks) : undefined,
      });

      if (!res.success) {
        toast.error(res.error.message || "Failed to create mock test.");
        return;
      }

      toast.success(
        `Mock test "${res.data.name}" created with ${res.data.totalQuestions} questions!`,
      );
      handleOpenChange(false);
      onTestCreated();
    } catch (err) {
      toast.error("Unexpected error creating mock test.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:max-w-3xl">
        <DialogHeader className="p-5 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </span>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Create Mock Test from Documents
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Assemble a full mock examination using ingested questions from selected documents.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Step 1: Document Selection */}
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Layers className="size-3.5 text-primary" />
                    <span>Select Source Documents</span>
                    <span className="text-destructive">*</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    All questions mapped to the selected documents will be incorporated into the mock test.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={handleSelectAllDocs}
                    className="text-[11px] h-7 px-2 text-muted-foreground hover:text-foreground"
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={handleClearAllDocs}
                    className="text-[11px] h-7 px-2 text-muted-foreground hover:text-foreground"
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>

              {/* Document Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter available documents..."
                  value={searchDocQuery}
                  onChange={(e) => setSearchDocQuery(e.target.value)}
                  className="h-8.5 w-full rounded-lg border border-border bg-background pl-8.5 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>

              {/* Documents List */}
              <div className="rounded-lg border border-border/80 bg-muted/20 p-2 max-h-52 overflow-y-auto space-y-1.5">
                {isLoadingDocs ? (
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span>Loading available documents...</span>
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    {searchDocQuery
                      ? "No documents match your search criteria."
                      : "No uploaded documents found. Please ingest documents first."}
                  </div>
                ) : (
                  filteredDocuments.map((doc) => {
                    const isSelected = selectedDocIds.includes(doc.id);
                    const hasQuestions = doc.questionCount > 0;

                    return (
                      <div
                        key={doc.id}
                        onClick={() => hasQuestions && handleToggleDoc(doc.id)}
                        className={`flex items-center justify-between p-2.5 rounded-md border text-xs transition-colors cursor-pointer select-none ${
                          isSelected
                            ? "border-primary/50 bg-primary/5 text-foreground"
                            : hasQuestions
                              ? "border-border/60 bg-card hover:bg-muted/50 text-foreground"
                              : "border-border/40 bg-muted/40 text-muted-foreground cursor-not-allowed opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <Checkbox
                            checked={isSelected}
                            disabled={!hasQuestions}
                            onCheckedChange={() => hasQuestions && handleToggleDoc(doc.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className={`size-3.5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                            <span className="font-medium truncate">{doc.title}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {hasQuestions ? (
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-5 px-1.5 ${
                                isSelected
                                  ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                                  : "border-border text-muted-foreground"
                              }`}
                            >
                              {doc.questionCount} {doc.questionCount === 1 ? "question" : "questions"}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">
                              0 questions (not processed)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Selection Summary Pill */}
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{selectedDocIds.length}</span> documents selected
                </span>
                <span className="text-muted-foreground">
                  Pool: <span className="font-semibold text-primary">{totalSelectedQuestions}</span> questions available
                </span>
              </div>
            </div>

            {/* Step 2: Test Configuration */}
            <div className="border-t border-border/60 pt-5 space-y-4">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                Mock Examination Parameters
              </h3>

              {/* Test Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span>Examination Title <span className="text-destructive">*</span></span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    Identifies this test in student dashboard
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Organic Chemistry Mid-Term Mock 2026"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>

              {/* Duration and Negative Marking Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Duration */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Clock className="size-3.5 text-muted-foreground" />
                      <span>Duration</span>
                    </label>
                    <span className="text-xs font-semibold text-primary">
                      {durationMinutes} minutes ({Math.floor(durationMinutes / 60)}h {durationMinutes % 60}m)
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {DURATION_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setDurationMinutes(preset.value)}
                        className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                          durationMinutes === preset.value
                            ? "border-primary bg-primary text-primary-foreground font-medium shadow-2xs"
                            : "border-border bg-card text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-muted-foreground">Custom:</span>
                    <input
                      type="number"
                      min={1}
                      max={600}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Math.max(1, Number(e.target.value)))}
                      className="h-7 w-20 rounded border border-border bg-background px-2 text-xs text-foreground focus:border-primary/50 focus:outline-none"
                    />
                    <span className="text-[11px] text-muted-foreground">mins</span>
                  </div>
                </div>

                {/* Negative Marking */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Percent className="size-3.5 text-muted-foreground" />
                      <span>Negative Marking Deduction</span>
                    </label>
                    <span className="text-xs font-semibold text-foreground">
                      {negativePercentage}% per incorrect answer
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {NEGATIVE_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setNegativePercentage(preset.value)}
                        className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                          negativePercentage === preset.value
                            ? "border-primary bg-primary text-primary-foreground font-medium shadow-2xs"
                            : "border-border bg-card text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-muted-foreground">Custom:</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={negativePercentage}
                      onChange={(e) =>
                        setNegativePercentage(Math.max(0, Math.min(100, Number(e.target.value))))
                      }
                      className="h-7 w-20 rounded border border-border bg-background px-2 text-xs text-foreground focus:border-primary/50 focus:outline-none"
                    />
                    <span className="text-[11px] text-muted-foreground">% per question</span>
                  </div>
                </div>
              </div>

              {/* Total Marks & Optional Custom Override */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Award className="size-3.5 text-muted-foreground" />
                    <span>Total Marks</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder={`Auto (${totalSelectedQuestions} marks)`}
                      value={customTotalMarks}
                      onChange={(e) => setCustomTotalMarks(e.target.value)}
                      className="h-8.5 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Leave blank to automatically sum all question marks ({totalSelectedQuestions} marks).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Instructions / Examination Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Calculator allowed. Read all instructions carefully before starting."
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none resize-none"
                  />
                </div>
              </div>

              {/* Review Summary Card */}
              {selectedDocIds.length > 0 && totalSelectedQuestions > 0 && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>Ready to assemble examination:</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-foreground">
                    <span>
                      <strong className="font-semibold text-primary">{totalSelectedQuestions}</strong> Questions
                    </span>
                    <span>•</span>
                    <span>
                      <strong className="font-semibold">{customTotalMarks || totalSelectedQuestions}</strong> Total Marks
                    </span>
                    <span>•</span>
                    <span>
                      <strong className="font-semibold">{durationMinutes}m</strong> Limit
                    </span>
                    <span>•</span>
                    <span>
                      <strong className="font-semibold">{negativePercentage}%</strong> Penalty
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border/60 bg-muted/30">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                isSubmitting ||
                selectedDocIds.length === 0 ||
                totalSelectedQuestions === 0 ||
                !testName.trim()
              }
              className="text-xs font-medium gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Assembling Mock Test...</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  <span>Create Mock Test ({totalSelectedQuestions} Qs)</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

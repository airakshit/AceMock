"use client";

import { useMemo, useState } from "react";
import { BookOpen, Search, X } from "lucide-react";
import { MockTestCard } from "@/components/patterns/mock-test-card";
import { mocksMockData } from "@/features/mocks/mockData";
import { layout } from "@/lib/design-system";
import { cn } from "@/lib/utils";

export function MocksView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("All");
  const [selectedSubject, setSelectedSubject] = useState<string>("All");

  const subjects = useMemo(() => {
    const set = new Set<string>();
    mocksMockData.tests.forEach((t) => {
      if (t.subject) set.add(t.subject);
    });
    return ["All", ...Array.from(set)];
  }, []);

  const difficulties = ["All", "Easy", "Medium", "Hard"];

  const filteredTests = useMemo(() => {
    return mocksMockData.tests.filter((test) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        test.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        test.subject?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDifficulty =
        selectedDifficulty === "All" || test.difficulty === selectedDifficulty;

      const matchesSubject =
        selectedSubject === "All" || test.subject === selectedSubject;

      return matchesSearch && matchesDifficulty && matchesSubject;
    });
  }, [searchQuery, selectedDifficulty, selectedSubject]);

  return (
    <div className="space-y-5">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-2xs md:flex-row md:items-center md:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search mock tests by keyword or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8.5 w-full rounded-md border border-border bg-background pl-8.5 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Difficulty:</span>
            <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5">
              {difficulties.map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setSelectedDifficulty(diff)}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                    selectedDifficulty === diff
                      ? "bg-card text-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          <span className="hidden sm:inline-block text-xs font-medium text-muted-foreground ml-auto">
            {filteredTests.length} {filteredTests.length === 1 ? "test" : "tests"}
          </span>
        </div>
      </div>

      {/* Subject Filter Chips */}
      {subjects.length > 2 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {subjects.map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => setSelectedSubject(sub)}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                selectedSubject === sub
                  ? "bg-foreground text-background font-medium"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      {/* Mock Tests Grid */}
      {filteredTests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-10 text-center">
          <div className="flex size-10 items-center justify-center rounded-md bg-muted/60 text-muted-foreground mb-2.5">
            <BookOpen className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">No matching mock tests</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            Try adjusting your search keywords or resetting difficulty and subject filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedDifficulty("All");
              setSelectedSubject("All");
            }}
            className="mt-3 text-xs font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className={layout.gridCards}>
          {filteredTests.map((test) => (
            <MockTestCard
              key={test.id}
              test={{
                id: test.id,
                title: test.title,
                durationMinutes: test.durationMinutes,
                totalQuestions: test.totalQuestions,
                subject: test.subject,
                difficulty: test.difficulty,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

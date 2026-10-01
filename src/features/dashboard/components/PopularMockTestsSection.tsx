"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  MockTestCard,
  type MockTestCardData,
} from "@/components/patterns/mock-test-card";
import { SectionHeader } from "@/components/patterns/page-header";
import { buttonVariants } from "@/components/ui/button";
import { layout } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import type { PopularMockTest } from "@/features/dashboard/types";

interface PopularMockTestsSectionProps {
  tests: PopularMockTest[];
}

function toCardData(test: PopularMockTest): MockTestCardData {
  return {
    id: test.id,
    title: test.title,
    durationMinutes: test.durationMinutes,
    totalQuestions: test.totalQuestions,
    subject: test.subject,
    difficulty: test.difficulty,
    isPopular: test.isPopular,
  };
}

export function PopularMockTestsSection({
  tests,
}: PopularMockTestsSectionProps) {
  const [selectedSubject, setSelectedSubject] = useState<string>("All");

  // Extract unique subjects for category filtering
  const subjects = useMemo(() => {
    const unique = new Set<string>();
    tests.forEach((t) => {
      if (t.subject) unique.add(t.subject);
    });
    return ["All", ...Array.from(unique)];
  }, [tests]);

  const filteredTests = useMemo(() => {
    if (selectedSubject === "All") return tests;
    return tests.filter((t) => t.subject === selectedSubject);
  }, [tests, selectedSubject]);

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Popular Mock Tests"
        description="Curated high-yield practice series attempted by top candidates."
        action={
          <Link
            href="/mocks"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors",
            )}
          >
            <span>View all</span>
            <ArrowRight className="size-3.5" />
          </Link>
        }
      />

      {/* Category Filter Chips */}
      {subjects.length > 2 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {subjects.map((subject) => {
            const isSelected = selectedSubject === subject;
            return (
              <button
                key={subject}
                type="button"
                onClick={() => setSelectedSubject(subject)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  isSelected
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {subject}
              </button>
            );
          })}
        </div>
      )}

      {/* Tests Responsive Grid */}
      <div className={layout.gridCards}>
        {filteredTests.map((test) => (
          <MockTestCard key={test.id} test={toCardData(test)} />
        ))}
      </div>
    </section>
  );
}

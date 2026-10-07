import {
  Atom,
  BookOpen,
  BookOpenText,
  ChevronDown,
  FlaskConical,
  Sigma,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/patterns/page-header";
import { CURRICULUM } from "@/constants/curriculum";

const SUBJECT_ICONS: Record<string, LucideIcon> = {
  physics: Atom,
  chemistry: FlaskConical,
  mathematics: Sigma,
  english: BookOpenText,
};

/** Static shape of `CURRICULUM` — keeps `Object.values` typed (it returns
 * `any[]` for the const-asserted union, which breaks implicit-any checks). */
interface CurriculumChapter {
  name: string;
  slug: string;
  description: string;
  grade?: number;
}

interface CurriculumSection {
  name: string;
  slug: string;
  description: string;
  chapters: readonly CurriculumChapter[];
}

interface CurriculumSubject {
  name: string;
  slug: string;
  sections: Record<string, CurriculumSection>;
}

export const metadata = {
  title: "Curriculum | ePeX",
  description: "Browse every subject, section and chapter in the syllabus.",
};

export default function CurriculumPage() {
  const subjects = Object.values(CURRICULUM) as CurriculumSubject[];

  return (
    <div className="flex-1 space-y-4 p-4 sm:space-y-5 md:p-6">
      <PageHeader
        title="Curriculum"
        description="The full syllabus — every subject, section and chapter in one place."
      />

      {subjects.map((subject, subjectIndex) => {
        const sections = Object.values(subject.sections);
        const chapterCount = sections.reduce(
          (total, section) => total + section.chapters.length,
          0,
        );
        const Icon = SUBJECT_ICONS[subject.slug] ?? BookOpen;

        return (
          <details
            key={subject.slug}
            open={subjectIndex === 0}
            className="group/subject rounded-2xl border border-border/80 bg-card shadow-card"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 p-5 focus-visible:outline-none sm:p-6 [&::-webkit-details-marker]:hidden">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-heading text-lg font-bold tracking-tight sm:text-xl">
                  {subject.name}
                </span>
                <span className="block text-xs text-muted-foreground sm:text-sm">
                  {sections.length}{" "}
                  {sections.length === 1 ? "section" : "sections"} ·{" "}
                  {chapterCount}{" "}
                  {chapterCount === 1 ? "chapter" : "chapters"}
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open/subject:rotate-180"
              />
            </summary>

            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              {/* Sections spine */}
              <ol className="relative space-y-6">
                <span
                  aria-hidden="true"
                  className="absolute top-3 bottom-3 left-[5px] w-px bg-border"
                />
                {sections.map((section, sectionIndex) => (
                  <li key={section.slug} className="relative flex gap-4">
                    <span
                      aria-hidden="true"
                      className="relative z-10 mt-1.5 size-3 shrink-0 rounded-full bg-brand ring-4 ring-brand/15"
                    />
                    <details
                      open={subjectIndex === 0 && sectionIndex === 0}
                      className="group/section min-w-0 flex-1"
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="font-heading text-base font-bold tracking-tight">
                              {section.name}
                            </span>
                            <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                              {section.chapters.length}{" "}
                              {section.chapters.length === 1
                                ? "chapter"
                                : "chapters"}
                            </span>
                          </span>
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/section:rotate-180"
                        />
                      </summary>
                      <div>
                        <p
                          title={section.description}
                          className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground"
                        >
                          {section.description}
                        </p>

                        {/* Chapters spine */}
                        <ol className="relative mt-4 space-y-4">
                          <span
                            aria-hidden="true"
                            className="absolute top-2 bottom-2 left-[3px] w-px bg-border/70"
                          />
                          {section.chapters.map((chapter) => (
                            <li
                              key={chapter.slug}
                              className="relative flex gap-3"
                            >
                              <span
                                aria-hidden="true"
                                className="relative z-10 mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground/50"
                              />
                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-semibold text-foreground">
                                  {chapter.name}
                                </h4>
                                <p
                                  title={chapter.description}
                                  className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground"
                                >
                                  {chapter.description}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </details>
                  </li>
                ))}
              </ol>
            </div>
          </details>
        );
      })}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { CURRICULUM } from "@/constants/curriculum";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { BookOpen, Layers, Library } from "lucide-react";

interface CurriculumChapter {
  readonly name: string;
  readonly slug: string;
  readonly grade: number;
}

interface CurriculumSection {
  readonly name: string;
  readonly slug: string;
  readonly chapters: readonly CurriculumChapter[];
}

interface CurriculumSubject {
  readonly name: string;
  readonly slug: string;
  readonly sections: Record<string, CurriculumSection>;
}

interface CurriculumSelectorProps {
  subjectSlug: string;
  sectionSlug: string;
  chapterSlug: string;
  onSubjectChange: (value: string) => void;
  onSectionChange: (value: string) => void;
  onChapterChange: (value: string) => void;
  disabled?: boolean;
  errors?: {
    subject?: string;
    section?: string;
    chapter?: string;
  };
}

export function CurriculumSelector({
  subjectSlug,
  sectionSlug,
  chapterSlug,
  onSubjectChange,
  onSectionChange,
  onChapterChange,
  disabled = false,
  errors,
}: CurriculumSelectorProps) {
  // Available subjects from CURRICULUM
  const subjects = useMemo(() => {
    return Object.values(
      CURRICULUM as unknown as Record<string, CurriculumSubject>,
    ).map((s) => ({
      slug: s.slug,
      name: s.name,
    }));
  }, []);

  // Available sections for the selected subject
  const currentSubjectObj = useMemo(() => {
    return Object.values(
      CURRICULUM as unknown as Record<string, CurriculumSubject>,
    ).find((s) => s.slug === subjectSlug);
  }, [subjectSlug]);

  const sections = useMemo(() => {
    if (!currentSubjectObj) return [];
    return Object.values(currentSubjectObj.sections).map((sec) => ({
      slug: sec.slug,
      name: sec.name,
    }));
  }, [currentSubjectObj]);

  // Available chapters for the selected section
  const currentSectionObj = useMemo(() => {
    if (!currentSubjectObj) return null;
    return (
      Object.values(currentSubjectObj.sections).find(
        (sec) => sec.slug === sectionSlug,
      ) || null
    );
  }, [currentSubjectObj, sectionSlug]);

  const chapters = useMemo(() => {
    if (!currentSectionObj) return [];
    return currentSectionObj.chapters.map((ch: CurriculumChapter) => ({
      slug: ch.slug,
      name: ch.name,
      grade: ch.grade,
    }));
  }, [currentSectionObj]);

  const handleSubjectSelect = (newSubject: string) => {
    onSubjectChange(newSubject);
    const subObj = Object.values(CURRICULUM).find((s) => s.slug === newSubject);
    if (subObj) {
      const firstSec = Object.values(subObj.sections)[0];
      if (firstSec) {
        onSectionChange(firstSec.slug);
        const firstChapter = firstSec.chapters[0];
        onChapterChange(firstChapter ? firstChapter.slug : "");
      } else {
        onSectionChange("");
        onChapterChange("");
      }
    } else {
      onSectionChange("");
      onChapterChange("");
    }
  };

  const handleSectionSelect = (newSection: string) => {
    onSectionChange(newSection);
    if (currentSubjectObj) {
      const secObj = Object.values(currentSubjectObj.sections).find(
        (s) => s.slug === newSection,
      );
      if (secObj && secObj.chapters.length > 0) {
        onChapterChange(secObj.chapters[0].slug);
      } else {
        onChapterChange("");
      }
    } else {
      onChapterChange("");
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Subject Selector */}
      <Field data-invalid={Boolean(errors?.subject)}>
        <FieldLabel className="flex items-center gap-1.5 text-xs font-semibold">
          <Library className="size-3.5 text-primary" />
          <span>Subject</span>
        </FieldLabel>
        <NativeSelect
          value={subjectSlug}
          disabled={disabled}
          onChange={(e) => handleSubjectSelect(e.target.value)}
          className="w-full"
        >
          <NativeSelectOption value="" disabled>
            Select Subject
          </NativeSelectOption>
          {subjects.map((sub) => (
            <NativeSelectOption key={sub.slug} value={sub.slug}>
              {sub.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {errors?.subject && <FieldError>{errors.subject}</FieldError>}
      </Field>

      {/* Section Selector */}
      <Field data-invalid={Boolean(errors?.section)}>
        <FieldLabel className="flex items-center gap-1.5 text-xs font-semibold">
          <Layers className="size-3.5 text-primary" />
          <span>Section</span>
        </FieldLabel>
        <NativeSelect
          value={sectionSlug}
          disabled={disabled || !subjectSlug || sections.length === 0}
          onChange={(e) => handleSectionSelect(e.target.value)}
          className="w-full"
        >
          <NativeSelectOption value="" disabled>
            {sections.length === 0 ? "No sections available" : "Select Section"}
          </NativeSelectOption>
          {sections.map((sec) => (
            <NativeSelectOption key={sec.slug} value={sec.slug}>
              {sec.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {errors?.section && <FieldError>{errors.section}</FieldError>}
      </Field>

      {/* Chapter Selector */}
      <Field data-invalid={Boolean(errors?.chapter)}>
        <FieldLabel className="flex items-center gap-1.5 text-xs font-semibold">
          <BookOpen className="size-3.5 text-primary" />
          <span>Chapter</span>
        </FieldLabel>
        <NativeSelect
          value={chapterSlug}
          disabled={disabled || !sectionSlug || chapters.length === 0}
          onChange={(e) => onChapterChange(e.target.value)}
          className="w-full"
        >
          <NativeSelectOption value="" disabled>
            {chapters.length === 0 ? "No chapters available" : "Select Chapter"}
          </NativeSelectOption>
          {chapters.map((ch: CurriculumChapter) => (
            <NativeSelectOption key={ch.slug} value={ch.slug}>
              {ch.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {errors?.chapter && <FieldError>{errors.chapter}</FieldError>}
      </Field>
    </div>
  );
}

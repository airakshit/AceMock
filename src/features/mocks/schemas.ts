import { z } from "zod";

import type { CreateCustomMockTestPayload } from "./dto/payloads";

/** The mock test scope options with their display labels. */
export const SCOPE_OPTIONS: Array<{
  value: "ioe_model" | "subject" | "section" | "chapter" | "miscellaneous";
  label: string;
  hint: string;
}> = [
  {
    value: "ioe_model",
    label: "IOE Model Format",
    hint: "Full IOE entrance model test",
  },
  { value: "subject", label: "SubjectWise", hint: "Everything in one subject" },
  { value: "section", label: "SectionWise", hint: "One section of a subject" },
  { value: "chapter", label: "ChapterWise", hint: "A single chapter" },
  {
    value: "miscellaneous",
    label: "Miscellaneous",
    hint: "Unscoped practice set",
  },
];

/**
 * Client-side validation for the custom mock test form.
 *
 * Mirrors the rules `mockTestsService.createCustomMockTest` enforces
 * server-side so problems surface inline instead of as toast errors
 * after the round trip.
 */
export const customMockTestFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Name must be at least 3 characters")
      .max(200, "Name must be 200 characters or less"),

    documentIds: z
      .array(z.string().uuid("Invalid document selected"))
      .min(1, "Select at least one document"),

    durationMinutes: z
      .number({ message: "Enter a duration in minutes" })
      .int("Duration must be a whole number of minutes")
      .min(1, "Duration must be at least 1 minute")
      .max(600, "Duration cannot exceed 600 minutes"),

    negativePercentagePerQuestion: z
      .number({ message: "Enter a negative marking percentage" })
      .int("Percentage must be a whole number")
      .min(0, "Percentage cannot be negative")
      .max(100, "Percentage cannot exceed 100"),

    instructions: z
      .string()
      .trim()
      .max(2000, "Instructions must be 2000 characters or less"),

    scope: z.enum([
      "ioe_model",
      "subject",
      "section",
      "chapter",
      "miscellaneous",
    ]),

    subjectId: z.string(),
    sectionId: z.string(),
    chapterId: z.string(),

    allowUntimed: z.boolean(),

    maxAttempts: z
      .number({ message: "Enter a retake limit" })
      .int("Retakes must be a whole number")
      .min(0, "Retakes cannot be negative")
      .max(100, "Retakes cannot exceed 100"),
  })
  .superRefine((data, ctx) => {
    // The scope decides which leaf id must travel — the service
    // derives its parents from that entity.
    const requireLeaf = (
      path: "subjectId" | "sectionId" | "chapterId",
      message: string,
    ) => {
      if (!data[path]) {
        ctx.addIssue({ code: "custom", path: [path], message });
      }
    };

    if (data.scope === "subject") requireLeaf("subjectId", "Select a subject");
    if (data.scope === "section") requireLeaf("sectionId", "Select a section");
    if (data.scope === "chapter") requireLeaf("chapterId", "Select a chapter");
  });

export type CustomMockTestFormData = z.infer<typeof customMockTestFormSchema>;

/**
 * Form data → `createCustomMockTestAction` payload. Only the leaf curriculum
 * id travels; the service derives its parents from that entity.
 */
export function toCustomMockTestPayload(
  data: CustomMockTestFormData,
): CreateCustomMockTestPayload {
  return {
    name: data.name,
    documentIds: data.documentIds,
    durationMinutes: data.durationMinutes,
    negativePercentagePerQuestion: data.negativePercentagePerQuestion,
    instructions: data.instructions.trim() || undefined,
    scope: data.scope,
    subjectId: data.scope === "subject" ? data.subjectId : undefined,
    sectionId: data.scope === "section" ? data.sectionId : undefined,
    chapterId: data.scope === "chapter" ? data.chapterId : undefined,
    allowUntimed: data.allowUntimed,
    maxAttempts: data.maxAttempts,
  };
}
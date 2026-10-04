import { z } from "zod";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

export const imageFileSchema = z.object({
  clientFileId: z.string().uuid(),
  file: z
    .instanceof(File)
    .refine(
      (file) => file.type.startsWith("image/"),
      "Only image files are allowed",
    )
    .refine(
      (file) => file.size <= MAX_IMAGE_SIZE,
      "Image must be smaller than 10 MB",
    ),
});

export const questionOptionSchema = z.object({
  key: z.enum(["A", "B", "C", "D"]),
  text: z.string().trim().min(1, "Option text cannot be empty"),
});

export const questionFormSchema = z
  .object({
    subjectSlug: z.string().min(1, "Please select a subject"),
    sectionSlug: z.string().min(1, "Please select a section"),
    chapterSlug: z.string().min(1, "Please select a chapter"),

    question: z
      .string()
      .trim()
      .min(1, "Question text is required")
      .max(5000, "Question must be 5000 characters or less"),

    options: z
      .array(questionOptionSchema)
      .length(4, "Exactly 4 options are required"),

    correctOption: z.enum(["A", "B", "C", "D"], {
      error: "Please select the correct option",
    }),

    marks: z
      .number()
      .int()
      .min(1, "Marks must be at least 1")
      .max(100, "Marks cannot exceed 100"),

    difficulty: z.enum(["easy", "medium", "hard"]),

    hint: z
      .string()
      .trim()
      .max(2000, "Hint must be 2000 characters or less")
      .optional()
      .or(z.literal("")),

    solution: z
      .string()
      .trim()
      .max(5000, "Solution must be 5000 characters or less")
      .optional()
      .or(z.literal("")),

    diagramFile: imageFileSchema.optional().nullable(),
    solutionDiagramFile: imageFileSchema.optional().nullable(),
  })
  .refine(
    (data) => {
      const hasSolutionText = Boolean(data.solution && data.solution.trim().length > 0);
      const hasSolutionDiagram = Boolean(data.solutionDiagramFile?.file);
      return hasSolutionText || hasSolutionDiagram;
    },
    {
      message: "Either a solution text or a solution diagram image is required",
      path: ["solution"],
    },
  );
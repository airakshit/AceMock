import { z } from "zod";

const optionKeySchema = z.enum(["A", "B", "C", "D"]);

const subjectSchema = z.enum([
    "Physics",
    "Chemistry",
    "Maths",
    "Grammar",
    "Comprehension",
]);

const questionDataSchema = z.object({
    // Primary identifier — required for every data item
    serialNo: z.number().int().positive(),

    // Question content
    question: z.string().optional(),

    // Options are only present when the question has options
    options: z
        .object({
            A: z.string().optional(),
            B: z.string().optional(),
            C: z.string().optional(),
            D: z.string().optional(),
        })
        .strict()
        .optional(),

    // Answer key — only A/B/C/D
    answerKey: optionKeySchema.optional(),

    // Required according to your prompt
    subject: subjectSchema,

    // Can be a string because your example uses "1"
    marks: z.string().optional(),

    // Step-by-step solution
    solution: z.string().optional(),

    // Generated SVG diagram
    diagram: z.string().optional(),

    // Page/question continuation metadata
    incomplete: z.boolean().optional(),
    isContinuation: z.boolean().optional(),
}).strict();

export const structuredOCRExtractionSchema = z
    .object({
        sectionLabel: z.string().optional(),

        sectionStart: z.number().int().positive().optional(),

        sectionEnds: z.number().int().positive().optional(),

        marks: z.number().optional(),

        paragraph: z.string().optional(),

        data: z.array(questionDataSchema),
    })
    .strict();



export type StructuredOCRExtractionResponse = z.infer<
    typeof structuredOCRExtractionSchema
>;
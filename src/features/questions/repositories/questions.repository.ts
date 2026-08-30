import { chapters, questions } from "@/db/schemas";
import { desc, eq } from "drizzle-orm";
import { DbExecutor } from "../../shared/types";
import { QuestionDifficulty, QuestionOption } from "../types";

export class QuestionsRepository {
  async findChapterBySlug(db: DbExecutor, slug: string) {
    const [chapter] = await db
      .select()
      .from(chapters)
      .where(eq(chapters.slug, slug))
      .limit(1);

    return chapter || null;
  }

  async create(
    db: DbExecutor,
    data: {
      id: string;
      chapterId: string;
      question: string;
      options: QuestionOption[];
      correctOption: string;
      marks: number;
      difficulty: QuestionDifficulty;
      diagram_url?: string | null;
      hint?: string | null;
      solution?: string | null;
      solution_diagram_url?: string | null;
    },
  ) {
    const [question] = await db
      .insert(questions)
      .values({
        id: data.id,
        chapterId: data.chapterId,
        question: data.question,
        options: data.options,
        correctOption: data.correctOption,
        marks: data.marks,
        difficulty: data.difficulty,
        diagram_url: data.diagram_url ?? null,
        hint: data.hint ?? null,
        solution: data.solution ?? null,
        solution_diagram_url: data.solution_diagram_url ?? null,
      })
      .returning();

    return question;
  }

  async findById(db: DbExecutor, id: string) {
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, id))
      .limit(1);

    return question || null;
  }

  async findRecent(db: DbExecutor, limit: number = 20) {
    return db
      .select()
      .from(questions)
      .orderBy(desc(questions.createdAt))
      .limit(limit);
  }
}

export const questionsRepository = new QuestionsRepository();

import { describe, expect, it } from "vitest";
import { parseQuestionInput } from "../src/features/questions/components/rendering-playground/parseQuestionInput";

describe("question rendering input", () => {
  it("renders plain text as a question", () => {
    const result = parseQuestionInput("A plain OCR question");

    expect(result.format).toBe("text");
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].questionText).toBe("A plain OCR question");
  });

  it("accepts a question object with array options and aliases", () => {
    const result = parseQuestionInput(
      JSON.stringify({
        question: "Choose an answer",
        choices: ["first", "second"],
        answer: "B",
      }),
    );

    expect(result.questions[0]).toMatchObject({
      questionText: "Choose an answer",
      options: [
        { key: "A", content: "first" },
        { key: "B", content: "second" },
      ],
      correctOption: "B",
    });
  });

  it("unwraps common response containers and renders every question", () => {
    const result = parseQuestionInput(
      JSON.stringify({
        data: {
          questions: [{ questionText: "First" }, { questionText: "Second" }],
        },
      }),
    );

    expect(result.questions.map((question) => question.questionText)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("reports malformed JSON rather than rendering it as ordinary text", () => {
    const result = parseQuestionInput('{"questionText":');

    expect(result.error).toBeDefined();
    expect(result.questions).toHaveLength(0);
  });

  it("preserves arbitrary JSON values as readable question text", () => {
    const result = parseQuestionInput('{"ocr_result":{"blocks":[1,2]}}');

    expect(result.questions[0].questionText).toContain('"ocr_result"');
  });
});

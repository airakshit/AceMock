import { describe, expect, it } from "vitest";
import { mergeOcrResults } from "../src/inngest/functions/v3/extract-questions/merge-ocr-results";
import type { OcrPageResult } from "../src/inngest/functions/v3/ocr-page/types";
import type {
  StructuredPageParseResult,
  SuperEntity,
} from "../src/inngest/functions/v3/ocr-page/super-schema";
import type {
  ResolvedQuestion,
  UnresolvedEntity,
} from "../src/inngest/functions/v3/extract-questions/types";
import type { OptionContent } from "../src/inngest/functions/v3/ocr-page/super-schema";

const box = { xMin: 0.1, yMin: 0.2, xMax: 0.3, yMax: 0.4 };

function makePage(input: {
  pageNo: number;
  entities: SuperEntity[];
  isStartOpen?: boolean;
  isEndOpen?: boolean;
  fileId?: string;
  sections?: StructuredPageParseResult["sections"];
}): OcrPageResult {
  return {
    pageNo: input.pageNo,
    pageId: `page-${input.pageNo}`,
    fileId: input.fileId ?? "file-1",
    rawText: `raw text of page ${input.pageNo}`,
    status: "completed",
    survivedValidation: true,
    isRelevant: true,
    isStartOpen: input.isStartOpen ?? false,
    isEndOpen: input.isEndOpen ?? false,
    parsedData: {
      pageNo: input.pageNo,
      isRelevant: true,
      isStartOpen: input.isStartOpen ?? false,
      isEndOpen: input.isEndOpen ?? false,
      sections: input.sections,
      entities: input.entities,
    },
  };
}

function entity(input: Partial<SuperEntity> & { path?: string[] }): SuperEntity {
  return {
    path: input.path,
    passage: input.passage,
    question: input.question,
    solution: input.solution,
    options: input.options,
    answerKey: input.answerKey,
  };
}

function questionEntity(
  path: string[] | undefined,
  text: string,
  figures: NonNullable<NonNullable<SuperEntity["question"]>["figures"]> = [],
): SuperEntity {
  return entity({
    path,
    question: { text, figures },
  });
}

function optionsFrom(
  values: Partial<Record<"A" | "B" | "C" | "D", OptionContent>>,
): NonNullable<SuperEntity["options"]> {
  return { A: undefined, B: undefined, C: undefined, D: undefined, ...values };
}

function pickQuestions(result: {
  questions: ResolvedQuestion[];
  unresolved: UnresolvedEntity[];
}): ResolvedQuestion[] {
  return result.questions;
}

describe("v3 stitching: identity & merging", () => {
  it("merges a question split across two pages by re-printed path", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        isEndOpen: true,
        entities: [questionEntity(["10"], "What is the value of")],
      }),
      makePage({
        pageNo: 2,
        isStartOpen: true,
        entities: [questionEntity(["10"], "$\\sqrt{2}$ to two decimals?")],
      }),
    ]);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].path).toEqual(["10"]);
    expect(result.questions[0].question).toBe(
      "What is the value of $\\sqrt{2}$ to two decimals?",
    );
    expect(result.questions[0].pageNos).toEqual([1, 2]);
    expect(result.unresolved).toHaveLength(0);
  });

  it("appends an unlabeled continuation fragment into the open record", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 3,
        isEndOpen: true,
        entities: [questionEntity(["5"], "Explain why the circuit", [box])],
      }),
      makePage({
        pageNo: 4,
        isStartOpen: true,
        entities: [questionEntity(undefined, "oscillates at resonance.")],
      }),
    ]);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].question).toBe(
      "Explain why the circuit oscillates at resonance.",
    );
    expect(result.questions[0].pageNos).toEqual([3, 4]);
    expect(result.questions[0].path).toEqual(["5"]);
  });

  it("sends an orphan unlabeled fragment to unresolved", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [questionEntity(undefined, "stray fragment")],
      }),
    ]);

    expect(result.questions).toHaveLength(0);
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0].reasons).toContain("unlabeled-fragment");
  });
});

describe("v3 stitching: stems & subquestions", () => {
  it("prefixes a stem into subquestions and never emits the stem as a question", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [
          questionEntity(["4"], "4. Answer the following in one word:"),
          questionEntity(["4", "i"], "(i) The plural of child is ____."),
          questionEntity(["4", "ii"], "(ii) The past tense of go is ____."),
        ],
      }),
    ]);

    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].path).toEqual(["4", "i"]);
    expect(result.questions[0].question).toBe(
      "4. Answer the following in one word: (i) The plural of child is ____.",
    );
    expect(result.questions[1].label).toBe("4(ii)");
  });

  it("gives a text-less, figure-only subquestion the stem as its question text", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [
          questionEntity(["4"], "4. Answer any two:"),
          entity({
            path: ["4", "ii"],
            question: { text: "", figures: [box] },
          }),
        ],
      }),
    ]);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].path).toEqual(["4", "ii"]);
    expect(result.questions[0].question).toBe("4. Answer any two:");
    expect(result.questions[0].questionFigures).toEqual([box]);
  });
});

describe("v3 stitching: incomplete paths", () => {
  it("resolves a sibling suffix (ii) printed without its parent", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [questionEntity(["4", "i"], "(i) First sub question.")],
      }),
      makePage({
        pageNo: 2,
        entities: [
          entity({
            path: ["ii"],
            question: { text: "(ii) Second sub question.", figures: [] },
          }),
        ],
      }),
    ]);

    expect(result.questions).toHaveLength(2);
    expect(result.questions[1].path).toEqual(["4", "ii"]);
    expect(result.questions[1].needsReview).toBe(true);
    expect(
      result.questions[1].reviewReasons?.some((reason) =>
        reason.startsWith("path-inherited"),
      ),
    ).toBe(true);
  });

  it("treats an advancing arabic label as a fresh top-level path", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [questionEntity(["4", "ii"], "Earlier sub question.")],
      }),
      makePage({
        pageNo: 2,
        entities: [
          entity({
            path: ["5"],
            question: { text: "Question five.", figures: [] },
          }),
        ],
      }),
    ]);

    expect(result.questions.map((q) => q.path)).toEqual([
      ["4", "ii"],
      ["5"],
    ]);
  });
});

describe("v3 stitching: answer rows & options", () => {
  it("attaches an answer-key row to its question by path", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [
          entity({
            path: ["9"],
            question: { text: "Question nine?", figures: [] },
            options: optionsFrom({
              A: { text: "one" },
              B: { text: "two" },
            }),
          }),
        ],
      }),
      makePage({
        pageNo: 2,
        entities: [entity({ path: ["9"], answerKey: "B" })],
      }),
    ]);

    const found = pickQuestions(result);
    expect(found[0].correctOption).toBe("B");
    expect(result.unresolved).toHaveLength(0);
  });

  it("keeps options present on the question entity itself", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [
          entity({
            path: ["2"],
            question: { text: "Pick one.", figures: [] },
            options: optionsFrom({
              A: { text: "alpha" },
              B: { text: "beta" },
            }),
            answerKey: "A",
          }),
        ],
      }),
    ]);

    const found = pickQuestions(result);
    expect(found[0].correctOption).toBe("A");
    expect(found[0].options).toEqual([
      { key: "A", text: "alpha" },
      { key: "B", text: "beta" },
    ]);
  });

  it("sends unmatched answer rows to unresolved", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [entity({ path: ["99"], answerKey: "C" })],
      }),
    ]);

    expect(result.questions).toHaveLength(0);
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0].reasons).toContain("unmatched-answer-row");
  });
});

describe("v3 stitching: passages", () => {
  it("binds comprehension questions to a chained passage", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        isEndOpen: true,
        entities: [
          entity({
            passage: {
              text: "First half of the passage,",
            },
          }),
        ],
      }),
      makePage({
        pageNo: 2,
        isStartOpen: true,
        isEndOpen: false,
        entities: [
          entity({
            passage: {
              text: "second half concludes the story.",
            },
          }),
          entity({
            path: ["15"],
            question: {
              text: "According to the passage, what happened last?",
              figures: [],
              subject: "comprehension",
            },
          }),
        ],
      }),
    ]);

    const found = pickQuestions(result);
    expect(found[0].passageContent).toBe(
      "First half of the passage, second half concludes the story.",
    );
  });
});

describe("v3 stitching: duplicate ids", () => {
  it("flags re-used same-path content with needsReview", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [
          questionEntity(["3"], "Part one of question three."),
          questionEntity(["3"], "Part two of question three (duplicate label)."),
        ],
      }),
    ]);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].needsReview).toBe(true);
    expect(result.questions[0].question.indexOf("Part two")).toBeGreaterThan(0);
  });
});

describe("v3 stitching: display labels", () => {
  it("formats nested paths", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [questionEntity(["7", "b"], "Sub question b of 7.")],
      }),
    ]);
    expect(result.questions[0].label).toBe("7(b)");
  });
});

import { describe, expect, it } from "vitest";
import { mergeOcrResults } from "../src/inngest/functions/v3/extract-questions/merge-ocr-results";
import type { OcrPageResult } from "../src/inngest/functions/v3/ocr-page/types";
import type { ExtractedFigure } from "../src/inngest/functions/v3/ocr-page/extract-figures";
import type {
  StructuredPageParseResult,
  SuperEntity,
  SuperStartState,
  SuperEndState,
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
  /** Page-top fragment continuing the previous page's entity (or null obj with refPath = fresh start). */
  startState?: SuperStartState | null;
  /** Page-bottom reference: printed path of the page's last entity. */
  endState?: SuperEndState | null;
  fileId?: string;
  sections?: StructuredPageParseResult["sections"];
}): OcrPageResult {
  const cleanStart: SuperStartState = { refPath: null, obj: null };
  const cleanEnd: SuperEndState = { refPath: null };
  return {
    pageNo: input.pageNo,
    pageId: `page-${input.pageNo}`,
    fileId: input.fileId ?? "file-1",
    rawText: `raw text of page ${input.pageNo}`,
    status: "completed",
    survivedValidation: true,
    isRelevant: true,
    startState: input.startState ?? cleanStart,
    endState: input.endState ?? cleanEnd,
    parsedData: {
      pageNo: input.pageNo,
      isRelevant: true,
      startState: input.startState ?? cleanStart,
      endState: input.endState ?? cleanEnd,
      sections: input.sections,
      entities: input.entities,
    },
  };
}

/** Marks the page bottom: reference to the page's last entity. */
function openEnd(refPath: string[] | null): SuperEndState {
  return { refPath };
}

function entity(input: Partial<SuperEntity> & { path?: string[] }): SuperEntity {
  return {
    path: input.path,
    passage: input.passage,
    question: input.question,
    solution: input.solution,
    options: input.options,
    answerKey: input.answerKey,
    figureResolved: input.figureResolved,
    figureNotFound: input.figureNotFound,
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
  it("merges a question split across two pages via the boundary states", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        // The stem is cut at the bottom; its head is an entity under its
        // printed path, and endState points to that path.
        endState: openEnd(["10"]),
        entities: [questionEntity(["10"], "What is the value of")],
      }),
      makePage({
        pageNo: 2,
        // The tail continues at the top; its label is not re-printed here
        // (refPath null) — the fragment pairs positionally with the open record.
        startState: {
          refPath: null,
          obj: questionEntity(undefined, "$\\sqrt{2}$ to two decimals?"),
        },
        entities: [],
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
        endState: openEnd(["5"]),
        entities: [questionEntity(["5"], "Explain why the circuit", [box])],
      }),
      makePage({
        pageNo: 4,
        // No label re-printed at the top — positional pairing.
        startState: {
          refPath: null,
          obj: questionEntity(undefined, "oscillates at resonance."),
        },
        entities: [],
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
        startState: {
          refPath: null,
          obj: questionEntity(undefined, "stray fragment"),
        },
        entities: [],
      }),
    ]);

    expect(result.questions).toHaveLength(0);
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0].reasons).toContain("unlabeled-fragment");
  });

  it("rebinds a pathless fragment's crops to the paired question's path", () => {
    // The figure+options fragment at the top of page 2 has no printed
    // label, so its crop is keyed under the synthetic "@start" slot.
    const figures: ExtractedFigure[] = [
      {
        pathKey: JSON.stringify(["@start"]),
        path: ["@start"],
        figureType: "option",
        optionKey: "A",
        storagePath: "figures/opt-a.png",
        bbox: box,
        pageNo: 2,
        fileId: "file-1",
      },
    ];
    const result = mergeOcrResults(
      [
        makePage({
          pageNo: 1,
          endState: openEnd(["30"]),
          entities: [questionEntity(["30"], "Question thirty with options?")],
        }),
        makePage({
          pageNo: 2,
          startState: {
            refPath: null,
            obj: entity({
              options: optionsFrom({ A: { text: "", figure: box } }),
            }),
          },
          entities: [],
        }),
      ],
      figures,
    );

    // After the merging the fragment's path is known: the crop re-binds.
    expect(figures[0].pathKey).toBe(JSON.stringify(["30"]));
    expect(figures[0].path).toEqual(["30"]);
    // The fragment's option box rode into the item as well.
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].path).toEqual(["30"]);
    expect(result.questions[0].optionFigures?.A).toEqual(box);
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
        // The passage is visible on page 1; its continuation travels to the
        // next page's startState fragment.
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
        // Its tail continues at the top; question 15 follows.
        startState: {
          refPath: null,
          obj: entity({
            passage: { text: "second half concludes the story." },
          }),
        },
        entities: [
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

describe("v3 stitching: sections & marks priority", () => {
  it("applies priority solution > question > section eachMarks", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        sections: [{ label: "Section A", eachMarks: 3 }],
        entities: [
          // Nothing printed -> section eachMarks wins.
          questionEntity(["1"], "No marks printed here."),
          // Question marks printed -> beats the section.
          entity({
            path: ["2"],
            question: { text: "Printed marks two.", figures: [], marks: 2 },
          }),
          // Solution marks printed -> beats the question marks.
          entity({
            path: ["3"],
            question: { text: "Both printed.", figures: [], marks: 2 },
            solution: { text: "sol.", figures: [], marks: 5, isStandalone: false },
          }),
          // Solution without marks -> question marks still stand.
          entity({
            path: ["4"],
            question: { text: "Q with plain solution.", figures: [], marks: 2 },
            solution: { text: "sol.", figures: [], isStandalone: false },
          }),
        ],
      }),
    ]);

    expect(result.questions.map((q) => q.marks)).toEqual([3, 2, 5, 2]);
  });

  it("continuesPathFromPrevious keeps the section alive; past endPath closes it", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        sections: [{ label: "Section A", eachMarks: 4, startPath: ["1"] }],
        endState: openEnd(["1"]),
        entities: [questionEntity(["1"], "First question.")],
      }),
      makePage({
        pageNo: 2,
        sections: [
          { label: "Section A", continuesPathFromPrevious: true, endPath: ["2"] },
        ],
        entities: [
          questionEntity(["2"], "Second question."),
          questionEntity(["3"], "Third question, outside the section range."),
        ],
      }),
    ]);

    const marks = new Map(result.questions.map((q) => [q.path[0], q.marks]));
    expect(marks.get("1")).toBe(4); // inside range -> eachMarks
    expect(marks.get("2")).toBe(4); // continuesPathFromPrevious -> still in range
    expect(marks.get("3")).toBe(1); // past endPath "2" -> range closed -> fallback
  });
});

describe("v3 stitching: boundary fragments", () => {
  it("merges an option-only fragment into the open record via positional pairing", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        endState: openEnd(["30"]),
        entities: [questionEntity(["30"], "Question thirty with options?")],
      }),
      makePage({
        pageNo: 2,
        // Options printed at the top with no label — they belong to the
        // question the previous page left open.
        startState: {
          refPath: null,
          obj: entity({
            question: { text: "", figures: [] },
            options: optionsFrom({
              A: { text: "alpha" },
              B: { text: "beta" },
            }),
          }),
        },
        entities: [],
      }),
    ]);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].path).toEqual(["30"]);
    expect(result.questions[0].options).toEqual([
      { key: "A", text: "alpha" },
      { key: "B", text: "beta" },
    ]);
  });

  it("starts a fresh question on the next page while the previous item stays as-is", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        endState: openEnd(["20"]),
        entities: [questionEntity(["20"], "Question twenty beginning...")],
      }),
      makePage({
        pageNo: 2,
        // Fresh start: page 2's first label is 21; the question twenty item
        // from page 1 simply stays as-is, question 21 stands on its own.
        startState: { refPath: ["21"], obj: null },
        entities: [
          questionEntity([
            "21",
          ], "A different new question printed after the cut."),
        ],
      }),
    ]);

    expect(result.unresolved).toHaveLength(0);
    expect(result.questions.map((q) => q.path)).toEqual([["20"], ["21"]]);
    expect(result.warnings).toHaveLength(0);
  });

  it("carries a three-page split through middle and end fragments", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        endState: openEnd(["8"]),
        entities: [questionEntity(["8"], "Head of question eight.")],
      }),
      makePage({
        pageNo: 2,
        // The top continuation fragment (no label re-printed) pairs with the
        // open record; the rest prints as entities under path ["8"].
        startState: {
          refPath: null,
          obj: questionEntity(undefined, "Middle chunk of question eight."),
        },
        entities: [
          questionEntity(["8"], "More of question eight."),
          questionEntity(["8"], "Tail start of question eight."),
        ],
        endState: openEnd(["8"]),
      }),
      makePage({
        pageNo: 3,
        startState: {
          refPath: null,
          obj: questionEntity(undefined, "Tail end of question eight."),
        },
        entities: [],
      }),
    ]);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].path).toEqual(["8"]);
    expect(result.questions[0].pageNos).toEqual([1, 2, 3]);
    expect(result.questions[0].question).toBe(
      "Head of question eight. Middle chunk of question eight. More of question eight. Tail start of question eight. Tail end of question eight.",
    );
  });
});

describe("v3 stitching: figure failure reasons", () => {
  it("derives figure_not_found when stage 2 found no matching diagram", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [
          entity({
            path: ["5"],
            question: { text: "q", figures: [box] },
            figureResolved: false,
            figureNotFound: true,
          }),
        ],
      }),
    ]);
    expect(result.questions[0].figureResolved).toBe(false);
    expect(result.questions[0].figureNotFound).toBe(true);
    // The confident negative wins over a merely missing box.
    expect(result.questions[0].failureReasons).toContain("figure_not_found");
  });

  it("derives figure_unresolved when a requested box was simply missing", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [
          entity({
            path: ["6"],
            question: { text: "q", figures: [box] },
            figureResolved: false,
          }),
        ],
      }),
    ]);
    expect(result.questions[0].failureReasons).toContain("figure_unresolved");
  });

  it("carries no figure failure reason when the figures resolved", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [entity({ path: ["7"], question: { text: "q", figures: [] } })],
      }),
    ]);
    const reasons = result.questions[0].failureReasons ?? [];
    expect(reasons.filter((reason) => reason.startsWith("figure_"))).toEqual([]);
  });
});

describe("v3 stitching: cross-section solution merging", () => {
  it("merges a solution printed in a separate Solutions section into its question", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        sections: [{ label: "Section A" }],
        entities: [questionEntity(["1"], "What is 2+2?")],
      }),
      makePage({
        pageNo: 2,
        sections: [{ label: "Solutions" }],
        entities: [
          entity({
            path: ["1"],
            solution: { text: "It is 4.", figures: [] },
          }),
        ],
      }),
    ]);
    expect(result.questions).toHaveLength(1);
    const q = result.questions[0];
    expect(q.solution).toBe("It is 4.");
    expect(q.failureReasons ?? []).not.toContain("missing solution");
    expect(result.unresolved).toHaveLength(0);
  });

  it("reconciles stray solution blocks when the solutions file arrives before the question file", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        fileId: "sol-file",
        // Solutions page headed with the NEXT range's section — the block is
        // still keyed under it, and no question record exists yet.
        sections: [{ label: "Section - II" }],
        entities: [
          entity({
            path: ["1"],
            solution: { text: "Sol for 1.", figures: [] },
            answerKey: "B",
          }),
        ],
      }),
      makePage({
        pageNo: 1,
        fileId: "q-file",
        sections: [{ label: "Section - I" }],
        entities: [
          entity({
            path: ["1"],
            question: { text: "Q1?", figures: [] },
            options: optionsFrom({ A: { text: "a" }, B: { text: "b" } }),
          }),
        ],
      }),
    ]);
    expect(result.questions).toHaveLength(1);
    const q = result.questions[0];
    expect(q.solution).toBe("Sol for 1.");
    expect(q.correctOption).toBe("B");
    expect(q.isReady).toBe(true);
    expect(q.failureReasons ?? []).toEqual([]);
    expect(result.unresolved).toHaveLength(0);
  });

  it("folds a re-printed question labelled with its answer letter (\"70(c)\") into question 70", () => {
    const result = mergeOcrResults([
      // Solutions paper first: re-prints the stem annotated "70(c)".
      makePage({
        pageNo: 1,
        fileId: "sol-file",
        sections: [{ label: "Solutions" }],
        entities: [
          entity({
            path: ["70", "c"],
            question: { text: "The deflection in a galvanometer is...", figures: [] },
            solution: { text: "Full solution for 70.", figures: [] },
          }),
        ],
      }),
      // Question paper: plain ["70"] with options.
      makePage({
        pageNo: 1,
        fileId: "q-file",
        sections: [{ label: "Section - I" }],
        entities: [
          entity({
            path: ["70"],
            question: { text: "The deflection in a galvanometer is...", figures: [] },
            options: optionsFrom({ A: { text: "a" }, B: { text: "b" }, C: { text: "c" }, D: { text: "d" } }),
          }),
        ],
      }),
    ]);
    expect(result.questions).toHaveLength(1);
    const q = result.questions[0];
    expect(q.pathKey).toBe(JSON.stringify(["70"]));
    expect(q.solution).toBe("Full solution for 70.");
    expect(q.options).toHaveLength(4);
    expect(result.unresolved).toHaveLength(0);
  });

  it("keeps real sub-questions (\"70(i)\", \"70(ii)\") as separate rows", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        sections: [{ label: "Section - I" }],
        entities: [
          entity({ path: ["70"], question: { text: "Passage stem 70.", figures: [] } }),
          entity({ path: ["70", "i"], question: { text: "Sub i?", figures: [] } }),
          entity({ path: ["70", "ii"], question: { text: "Sub ii?", figures: [] } }),
        ],
      }),
    ]);
    expect(result.questions.map((q) => q.pathKey)).toEqual(
      expect.arrayContaining([
        JSON.stringify(["70", "i"]),
        JSON.stringify(["70", "ii"]),
      ]),
    );
  });

  it("sends an ambiguous cross-section solution block to the resolver instead of silently dropping it", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        sections: [{ label: "Section A" }],
        entities: [questionEntity(["1"], "Question A1?")],
      }),
      makePage({
        pageNo: 2,
        sections: [{ label: "Section B" }],
        entities: [questionEntity(["1"], "Question B1?")],
      }),
      makePage({
        pageNo: 3,
        sections: [{ label: "Solutions" }],
        entities: [
          entity({
            path: ["1"],
            solution: { text: "Shared solution.", figures: [] },
          }),
        ],
      }),
    ]);
    expect(result.questions).toHaveLength(2);
    expect(result.questions.every((q) => q.solution === null)).toBe(true);
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0].reasons.join(" ")).toContain(
      "ambiguous-attachment",
    );
  });
});

describe("v3 stitching: solution blocks carrying answer keys", () => {
  it("merges Solutions-section blocks (solution text + printed key) instead of dropping them as answer rows", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        sections: [
          { label: "Section - I", startPath: ["1"], endPath: ["2"], eachMarks: 1 },
        ],
        entities: [
          entity({
            path: ["1"],
            question: { text: "Q one?", figures: [] },
            options: optionsFrom({ A: { text: "a" }, B: { text: "b" } }),
          }),
          entity({
            path: ["2"],
            question: { text: "Q two?", figures: [] },
            options: optionsFrom({ A: { text: "a" }, B: { text: "b" } }),
          }),
        ],
      }),
      makePage({
        pageNo: 2,
        sections: [{ label: "Section - I", startPath: ["1"], endPath: ["2"] }],
        entities: [
          entity({
            path: ["1"],
            solution: { text: "Because B.", figures: [] },
            answerKey: "B",
          }),
          // Pure answer-key row (no solution narrative) stays an answer row.
          entity({ path: ["2"], answerKey: "A" }),
        ],
      }),
    ]);
    expect(result.questions).toHaveLength(2);
    const [q1, q2] = result.questions;

    expect(q1.solution).toBe("Because B.");
    expect(q1.correctOption).toBe("B");
    expect(q1.isReady).toBe(true);
    expect(q1.failureReasons ?? []).toEqual([]);
    expect(q1.needsReview).toBe(false);

    expect(q2.correctOption).toBe("A");
    expect(q2.solution).toBeNull();
    expect(q2.isReady).toBe(false);
    expect(q2.failureReasons).toEqual(["missing solution"]);
  });

  it("keeps solution figures and answer value from Solutions-section blocks", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [
          entity({
            path: ["3"],
            question: { text: "Q three?", figures: [] },
            options: optionsFrom({ A: { text: "a" }, B: { text: "b" } }),
          }),
        ],
      }),
      makePage({
        pageNo: 2,
        sections: [{ label: "Solutions" }],
        entities: [
          entity({
            path: ["3"],
            solution: { text: "x = 5", figures: [box], answerValue: "5" },
            answerKey: "A",
          }),
        ],
      }),
    ]);
    const q = result.questions[0];
    expect(q.solution).toBe("x = 5");
    expect(q.answerValue).toBe("5");
    expect(q.correctOption).toBe("A");
    expect(q.solutionFigures ?? []).toEqual([box]);
    expect(q.figureResolved).toBe(true);
  });
});

describe("v3 stitching: readiness (is_ready / not_ready_reason reasons)", () => {
  it("marks a complete MCQ ready", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [
          entity({
            path: ["2"],
            question: { text: "Pick one.", figures: [] },
            options: optionsFrom({ A: { text: "alpha" }, B: { text: "beta" } }),
            answerKey: "A",
            solution: { text: "Because alpha.", figures: [] },
          }),
        ],
      }),
    ]);
    expect(result.questions[0].isReady).toBe(true);
    expect(result.questions[0].failureReasons ?? []).toEqual([]);
  });

  it("lists readiness reason codes for incomplete questions", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [questionEntity(["1"], "Bare question, nothing else.")],
      }),
    ]);
    const q = result.questions[0];
    expect(q.isReady).toBe(false);
    expect(q.failureReasons).toEqual([
      "missing solution",
      "missing answer key",
    ]);
  });

  it("clears missing answer key once an answer row matches", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [
          entity({
            path: ["9"],
            question: { text: "Question nine?", figures: [] },
            options: optionsFrom({ A: { text: "one" }, B: { text: "two" } }),
            solution: { text: "Because B.", figures: [] },
          }),
        ],
      }),
      makePage({
        pageNo: 2,
        entities: [entity({ path: ["9"], answerKey: "B" })],
      }),
    ]);
    const q = result.questions[0];
    expect(q.correctOption).toBe("B");
    expect(q.failureReasons ?? []).toEqual([]);
    expect(q.isReady).toBe(true);
  });
});

describe("v3 stitching: standalone rewrite jobs", () => {
  it("queues non-standalone subquestions with parent stem + fallback text", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [
          questionEntity(["4"], "4. Answer the following in one word:"),
          questionEntity(["4", "i"], "(i) The plural of child is ____."),
        ],
      }),
    ]);

    expect(result.standaloneRewrites).toHaveLength(1);
    const job = result.standaloneRewrites[0];
    expect(job.pathKey).toBe(result.questions[0].pathKey);
    expect(job.parentStem).toBe("4. Answer the following in one word:");
    expect(job.ownQuestionText).toBe("(i) The plural of child is ____.");
    expect(job.fallbackQuestion).toBe(
      "4. Answer the following in one word: (i) The plural of child is ____.",
    );
    expect(job.figureAnnotations).toEqual([]);
  });

  it("keeps standalone questions out of the rewrite queue but joins no stem", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [
          questionEntity(["4"], "4. Answer the following in one word:"),
          entity({
            path: ["4", "i"],
            question: {
              text: "(i) Standalone sub question.",
              figures: [],
              isStandalone: true,
            },
          }),
        ],
      }),
    ]);

    expect(result.standaloneRewrites).toHaveLength(0);
    // isStandalone=true -> stem NOT joined into the question text.
    expect(result.questions[0].question).toBe("(i) Standalone sub question.");
  });

  it("annotates figures as [[FIG:<path>]] tokens in the rewrite job", () => {
    const result = mergeOcrResults([
      makePage({
        pageNo: 1,
        entities: [
          entity({
            path: ["4"],
            question: { text: "4. See the circuit below:", figures: [box] },
          }),
          questionEntity(["4", "i"], "(i) What flows in the wire?"),
        ],
      }),
    ]);

    expect(result.standaloneRewrites).toHaveLength(1);
    const job = result.standaloneRewrites[0];
    // One token for the parent's figure — the image data itself is never sent.
    expect(job.figureAnnotations).toEqual(["[[FIG:4]]"]);
    expect(job.parentStem).toBe("4. See the circuit below:");
  });
});

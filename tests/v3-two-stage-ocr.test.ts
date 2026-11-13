import { describe, expect, it } from "vitest";
import { OcrMergeError } from "../src/inngest/functions/v3/ocr-page/errors";
import {
  collectFigureTargets,
  mergeStage1AndStage2,
  parsePartialStructuredOCR,
  parseStage2BoundingBoxes,
} from "../src/inngest/functions/v3/ocr-page/utils";
import type {
  PartialPageParseResult,
  Stage2BoundingBoxResult,
} from "../src/inngest/functions/v3/ocr-page/partial-schemas";

/** Parses a stage-1 response and asserts it survived validation. */
function stage1(raw: unknown): PartialPageParseResult {
  const result = parsePartialStructuredOCR(JSON.stringify(raw));
  expect(result.survivedValidation).toBe(true);
  expect(result.parsedStructuredData).toBeDefined();
  return result.parsedStructuredData!;
}

/** Parses a raw stage-2 response and asserts it survived validation. */
function stage2(items: unknown[]): Stage2BoundingBoxResult {
  const result = parseStage2BoundingBoxes(JSON.stringify({ items }));
  expect(result.survivedValidation).toBe(true);
  expect(result.parsedStructuredData).toBeDefined();
  return result.parsedStructuredData!;
}

const nativeBox = { xMin: 100, yMin: 200, xMax: 300, yMax: 400 };
const unitBox = { xMin: 0.1, yMin: 0.2, xMax: 0.3, yMax: 0.4 };

describe("v3 two-stage OCR: stage-1 parsing", () => {
  it("drops a page whose entities are all null instead of failing it", () => {
    // The model echoed back an entities array of pure nulls â€” model noise,
    // not an extraction failure. A literal `[null, ...]` array is tolerated
    // at the schema level too.
    const result = parsePartialStructuredOCR(
      JSON.stringify({
        pageNo: 9,
        isRelevant: true,
        startState: { refPath: null, obj: null },
        endState: { refPath: null, obj: null },
        sections: null,
        entities: [null, null],
      }),
    );
    expect(result.survivedValidation).toBe(true);
    expect(result.parsedStructuredData!.entities).toEqual([]);
  });

  it("drops null/empty entities from a mixed page and keeps the real ones", () => {
    const result = parsePartialStructuredOCR(
      JSON.stringify({
        pageNo: 9,
        isRelevant: true,
        startState: { refPath: null, obj: null },
        endState: { refPath: null, obj: null },
        sections: null,
        entities: [
          null,
          // All fields null -> collapses to an empty object after
          // nullsToUndefined; still just noise.
          { path: null, question: null, solution: null, options: null, answerKey: null },
          // A bare printed path with nothing extractable â€” dropped too.
          { path: ["12"] },
          {
            path: ["1"],
            question: { text: "q", hasFigure: false, isStandalone: false },
            solution: null,
            options: null,
            answerKey: null,
          },
        ],
      }),
    );
    expect(result.survivedValidation).toBe(true);
    expect(result.parsedStructuredData!.entities).toHaveLength(1);
    expect(result.parsedStructuredData!.entities[0].question?.text).toBe("q");
  });

  it("parses path-identified entities with hasFigure flags", () => {
    const parsed = stage1({
      pageNo: 1,
      isRelevant: true,
      startState: { refPath: null, obj: null },
      endState: { refPath: null, obj: null },
      sections: null,
      entities: [
        {
          path: ["4", "ii"],
          passage: null,
          question: {
            text: "Sub question (ii).",
            hasFigure: false,
            marks: null,
            subject: "grammar",
            isStandalone: true,
          },
          solution: null,
          options: {
            A: { text: "a", hasFigure: false },
            B: { text: null, hasFigure: true },
            C: null,
            D: null,
          },
          answerKey: "C",
          answerValue: null,
        },
      ],
    });

    const entity = parsed.entities[0];
    expect(entity.path).toEqual(["4", "ii"]);
    expect(entity.question?.hasFigure).toBe(false);
    expect(entity.options?.B?.hasFigure).toBe(true);
    expect(entity.answerKey).toBe("C");
  });

  it("accepts an unlabeled continuation entity (path null)", () => {
    const parsed = stage1({
      pageNo: 2,
      isRelevant: true,
      startState: { refPath: null, obj: null },
      endState: { refPath: null, obj: null },
      sections: null,
      entities: [
        {
          path: null,
          question: {
            text: "...continued.",
            hasFigure: false,
            marks: null,
            subject: null,
            isStandalone: true,
          },
          solution: null,
          options: null,
          answerKey: null,
          answerValue: null,
        },
      ],
    });
    expect(parsed.entities[0].path).toBeUndefined();
  });
});

describe("v3 two-stage OCR: collectFigureTargets", () => {
  it("collects one target per entity with the requested parts", () => {
    const parsed = stage1({
      pageNo: 1,
      isRelevant: true,
      startState: { refPath: null, obj: null },
      endState: { refPath: null, obj: null },
      sections: null,
      entities: [
        {
          path: ["9"],
          question: { text: "q", hasFigure: true, isStandalone: false },
          solution: { text: "s", hasFigure: false, isStandalone: false },
          options: {
            A: { text: null, hasFigure: true },
            B: { text: "b", hasFigure: false },
            C: { text: null, hasFigure: true },
            D: null,
          },
          answerKey: null,
          answerValue: null,
        },
        {
          path: ["10"],
          question: { text: "q2", hasFigure: false, isStandalone: false },
          solution: null,
          options: null,
          answerKey: null,
          answerValue: null,
        },
      ],
    });

    expect(collectFigureTargets(parsed)).toEqual([
      {
        path: ["9"],
        needs: { question: true, solution: false, options: ["A", "C"] },
        questionText: "q",
        // Options without printed text contribute no context.
        optionTexts: undefined,
      },
    ]);
  });

  it("threads question and option text into the stage-2 target context", () => {
    const parsed = stage1({
      pageNo: 1,
      isRelevant: true,
      startState: { refPath: null, obj: null },
      endState: { refPath: null, obj: null },
      sections: null,
      entities: [
        {
          path: ["3"],
          question: {
            text: "In the given circuit, find the current through the resistor.",
            hasFigure: true,
            isStandalone: false,
          },
          solution: null,
          options: {
            A: { text: "2 A", hasFigure: false },
            B: { text: "4 A", hasFigure: false },
            C: { text: " 6 A ", hasFigure: true },
            D: null,
          },
          answerKey: null,
          answerValue: null,
        },
      ],
    });

    expect(collectFigureTargets(parsed)).toEqual([
      {
        path: ["3"],
        needs: { question: true, solution: false, options: ["C"] },
        questionText:
          "In the given circuit, find the current through the resistor.",
        optionTexts: { C: "6 A" },
      },
    ]);
  });

  it("merges duplicate unlabeled targets and throws on two unlabeled entities", () => {
    const single = stage1({
      pageNo: 1,
      isRelevant: true,
      startState: { refPath: null, obj: null },
      endState: { refPath: null, obj: null },
      sections: null,
      entities: [
        {
          path: null,
          question: { text: "q", hasFigure: true, isStandalone: false },
          solution: null,
          options: null,
          answerKey: null,
        },
      ],
    });
    expect(collectFigureTargets(single)).toEqual([
      {
        path: null,
        needs: { question: true, solution: false, options: [] },
        questionText: "q",
        optionTexts: undefined,
      },
    ]);

    const ambiguous = stage1({
      pageNo: 1,
      isRelevant: true,
      startState: { refPath: null, obj: null },
      endState: { refPath: null, obj: null },
      sections: null,
      entities: [
        {
          path: null,
          question: { text: "q1", hasFigure: true, isStandalone: false },
          solution: null,
          options: null,
          answerKey: null,
        },
        {
          path: null,
          question: { text: "q2", hasFigure: true, isStandalone: false },
          solution: null,
          options: null,
          answerKey: null,
        },
      ],
    });
    expect(() => collectFigureTargets(ambiguous)).toThrow(OcrMergeError);
  });
});

describe("v3 two-stage OCR: merge (strict)", () => {
  it("merges stage-1 and stage-2 with native 0-1000 -> 0-1 rescale", () => {
    const s1 = stage1({
      pageNo: 1,
      isRelevant: true,
      startState: { refPath: null, obj: null },
      endState: { refPath: null, obj: null },
      sections: null,
      entities: [
        {
          path: ["2"],
          question: {
            text: "Which circuit?",
            hasFigure: true,
            isStandalone: false,
          },
          solution: null,
          options: {
            A: { text: null, hasFigure: true },
            B: { text: "text b", hasFigure: false },
            C: null,
            D: null,
          },
          answerKey: "A",
          answerValue: null,
        },
      ],
    });
    const s2 = stage2([
      {
        path: ["2"],
        questionFigures: [nativeBox],
        solutionFigures: [],
        optionFigures: { A: nativeBox, B: null, C: null, D: null },
      },
    ]);

    const merged = mergeStage1AndStage2(s1, s2);
    const entity = merged.entities[0];

    expect(entity.question?.figures).toEqual([unitBox]);
    expect(entity.options?.A?.figure).toEqual(unitBox);
    expect(entity.options?.A?.text).toBeUndefined();
    expect(entity.options?.B).toEqual({ text: "text b" });
    expect(entity.solution).toBeUndefined();
  });

  it("merges the unlabeled continuation entity against the null-path stage-2 item", () => {
    const s1 = stage1({
      pageNo: 2,
      isRelevant: true,
      startState: { refPath: null, obj: null },
      endState: { refPath: null, obj: null },
      sections: null,
      entities: [
        {
          path: null,
          question: { text: "...continued", hasFigure: true, isStandalone: false },
          solution: null,
          options: null,
          answerKey: null,
        },
      ],
    });
    const s2 = stage2([
      {
        path: null,
        questionFigures: [nativeBox],
        solutionFigures: [],
        optionFigures: null,
      },
    ]);

    const merged = mergeStage1AndStage2(s1, s2);
    expect(merged.entities[0].question?.figures).toEqual([unitBox]);
  });

  it("keeps the duplicate stage-2 path hard error (ambiguous, not lossy)", () => {
    // Stage-1 requests ["1"]; stage-2 echoes it twice â€” the first echo
    // binds, the second cannot be merged losslessly, so this stays a hard
    // error (duplicates are ambiguous, not skippable).
    const s1 = stage1({
      pageNo: 1,
      isRelevant: true,
      startState: { refPath: null, obj: null },
      endState: { refPath: null, obj: null },
      sections: null,
      entities: [
        {
          path: ["1"],
          question: { text: "q", hasFigure: true, isStandalone: false },
          solution: null,
          options: null,
          answerKey: null,
        },
      ],
    });
    const s2 = stage2([
      {
        path: ["1"],
        questionFigures: [nativeBox],
        solutionFigures: [],
        optionFigures: null,
      },
      {
        path: ["1"],
        questionFigures: [],
        solutionFigures: [],
        optionFigures: null,
      },
    ]);
    expect(() => mergeStage1AndStage2(s1, s2)).toThrow(OcrMergeError);
  });

  it("merges two unlabeled figure entities losslessly when stage-2 has no unlabeled boxes", () => {
    // The hard "two unlabeled entities" ambiguity lives in
    // collectFigureTargets (tested above). The MERGE itself is tolerant:
    // both entities lost their figure request (figureResolved=false), and
    // the page never fails.
    const s1 = stage1({
      pageNo: 1,
      isRelevant: true,
      startState: { refPath: null, obj: null },
      endState: { refPath: null, obj: null },
      sections: null,
      entities: [
        {
          path: null,
          question: { text: "q1", hasFigure: true, isStandalone: false },
          solution: null,
          options: null,
          answerKey: null,
        },
        {
          path: null,
          question: { text: "q2", hasFigure: true, isStandalone: false },
          solution: null,
          options: null,
          answerKey: null,
        },
      ],
    });

    const merged = mergeStage1AndStage2(s1, { items: [] });
    expect(merged.entities).toHaveLength(2);
    expect(merged.entities[0].question?.figures).toEqual([]);
    expect(merged.entities[1].question?.figures).toEqual([]);
    expect(merged.entities[0].figureResolved).toBe(false);
    expect(merged.entities[1].figureResolved).toBe(false);
  });

  it("throws on two unlabeled entities when stage-2 DID report one unlabeled item", () => {
    const s1 = stage1({
      pageNo: 1,
      isRelevant: true,
      startState: { refPath: null, obj: null },
      endState: { refPath: null, obj: null },
      sections: null,
      entities: [
        {
          path: null,
          question: { text: "q1", hasFigure: true, isStandalone: false },
          solution: null,
          options: null,
          answerKey: null,
        },
        {
          path: null,
          question: { text: "q2", hasFigure: true, isStandalone: false },
          solution: null,
          options: null,
          answerKey: null,
        },
      ],
    });
    const s2 = stage2([
      {
        path: null,
        questionFigures: [nativeBox],
        solutionFigures: [],
        optionFigures: null,
      },
    ]);
    // One unlabeled box with two claimants is genuinely ambiguous.
    expect(() => mergeStage1AndStage2(s1, s2)).toThrow(OcrMergeError);
  });
});

describe("v3 two-stage OCR: merge (tolerant â€” stage-2 slips never fail the page)", () => {
  it("ignores an unrequested stage-2 path with a warning instead of throwing", () => {
    const s1 = stage1({
      pageNo: 1,
      isRelevant: true,
      startState: { refPath: null, obj: null },
      endState: { refPath: null, obj: null },
      sections: null,
      entities: [],
    });
    const s2 = stage2([
      {
        path: ["7"],
        questionFigures: [nativeBox],
        solutionFigures: [],
        optionFigures: null,
      },
    ]);

    const merged = mergeStage1AndStage2(s1, s2);
    // The hallucinated item is dropped wholesale; the page itself survives.
    expect(merged.entities).toHaveLength(0);
  });

  it("degrades gracefully when hasFigure=true but stage-2 has no box (figureResolved=false)", () => {
    const s1 = stage1({
      pageNo: 1,
      isRelevant: true,
      startState: { refPath: null, obj: null },
      endState: { refPath: null, obj: null },
      sections: null,
      entities: [
        {
          path: ["1"],
          question: { text: "q", hasFigure: true, isStandalone: false },
          solution: null,
          options: null,
          answerKey: null,
        },
      ],
    });
    const s2 = stage2([
      {
        path: ["1"],
        questionFigures: [],
        solutionFigures: [],
        optionFigures: null,
      },
    ]);

    const merged = mergeStage1AndStage2(s1, s2);
    const entity = merged.entities[0];
    expect(entity.question?.text).toBe("q");
    expect(entity.question?.figures).toEqual([]);
    expect(entity.figureResolved).toBe(false);
  });

  it("ignores stage-2 figures for a part stage-1 marked hasFigure=false", () => {
    const s1 = stage1({
      pageNo: 1,
      isRelevant: true,
      startState: { refPath: null, obj: null },
      endState: { refPath: null, obj: null },
      sections: null,
      entities: [
        {
          path: ["1"],
          question: { text: "q", hasFigure: false, isStandalone: false },
          solution: null,
          options: null,
          answerKey: null,
        },
      ],
    });
    const s2 = stage2([
      {
        path: ["1"],
        questionFigures: [nativeBox],
        solutionFigures: [],
        optionFigures: null,
      },
    ]);

    const merged = mergeStage1AndStage2(s1, s2);
    const entity = merged.entities[0];
    expect(entity.question?.figures).toEqual([]);
    // No figure was ever requested, so nothing is marked unresolved.
    expect(entity.figureResolved).toBe(true);
  });

  it("degrades option figures the same way (text-only option, figureResolved=false)", () => {
    const s1 = stage1({
      pageNo: 1,
      isRelevant: true,
      startState: { refPath: null, obj: null },
      endState: { refPath: null, obj: null },
      sections: null,
      entities: [
        {
          path: ["3"],
          question: { text: "q", hasFigure: false, isStandalone: false },
          solution: null,
          options: {
            A: { text: "alpha", hasFigure: true },
            B: { text: "beta", hasFigure: false },
            C: null,
            D: null,
          },
          answerKey: null,
          answerValue: null,
        },
      ],
    });
    const s2 = stage2([
      {
        path: ["3"],
        questionFigures: [],
        solutionFigures: [],
        // Stage-2 lost the option A box entirely.
        optionFigures: { A: null, B: null, C: null, D: null },
      },
    ]);

    const merged = mergeStage1AndStage2(s1, s2);
    const entity = merged.entities[0];
    expect(entity.options?.A).toEqual({ text: "alpha" });
    expect(entity.options?.B).toEqual({ text: "beta" });
    expect(entity.figureResolved).toBe(false);
  });

  it("propagates noMatchingFigure=true as figureNotFound + figureResolved=false", () => {
    const s1 = stage1({
      pageNo: 1,
      isRelevant: true,
      startState: { refPath: null, obj: null },
      endState: { refPath: null, obj: null },
      sections: null,
      entities: [
        {
          path: ["5"],
          question: {
            text: "In the given circuit, find the current.",
            hasFigure: true,
            isStandalone: false,
          },
          solution: null,
          options: null,
          answerKey: null,
          answerValue: null,
        },
        {
          path: ["6"],
          question: { text: "q6", hasFigure: true, isStandalone: false },
          solution: null,
          options: null,
          answerKey: null,
          answerValue: null,
        },
      ],
    });
    const s2 = stage2([
      {
        path: ["5"],
        questionFigures: [],
        solutionFigures: [],
        optionFigures: null,
        // The model read "In the given circuit..." and found no matching
        // diagram â€” a confident negative.
        noMatchingFigure: true,
      },
      {
        path: ["6"],
        questionFigures: [nativeBox],
        solutionFigures: [],
        optionFigures: null,
        noMatchingFigure: false,
      },
    ]);

    const merged = mergeStage1AndStage2(s1, s2);
    expect(merged.entities[0].figureNotFound).toBe(true);
    expect(merged.entities[0].figureResolved).toBe(false);
    // A found diagram is unaffected.
    expect(merged.entities[1].figureNotFound).toBe(false);
    expect(merged.entities[1].figureResolved).toBe(true);
  });
});

describe("v3 two-stage OCR: page-boundary fragments", () => {
  it("parses startState/endState fragments and collapses refPath noise", () => {
    const parsed = stage1({
      pageNo: 2,
      isRelevant: true,
      startState: {
        refPath: null,
        obj: {
          passage: null,
          question: {
            text: "...continued.",
            hasFigure: true,
            marks: null,
            subject: null,
            isStandalone: false,
          },
          solution: null,
          options: null,
          answerKey: null,
        },
      },
      // The model echoed the string "null" — still a clean boundary.
      endState: { refPath: "null", obj: null },
      sections: null,
      entities: [],
    });

    expect(parsed.startState.refPath).toBeNull();
    expect(parsed.startState.obj?.question?.hasFigure).toBe(true);
    expect(parsed.endState.refPath).toBeNull();
  });

  it("collapses a content-less fragment to a clean boundary", () => {
    const result = parsePartialStructuredOCR(
      JSON.stringify({
        pageNo: 1,
        isRelevant: true,
        startState: {
          refPath: null,
          obj: {
            passage: null,
            question: null,
            solution: null,
            options: null,
            answerKey: null,
          },
        },
        endState: null,
        sections: null,
        entities: [],
      }),
    );
    expect(result.survivedValidation).toBe(true);
    expect(result.parsedStructuredData!.startState.obj).toBeNull();
    expect(result.parsedStructuredData!.endState.refPath).toBeNull();
  });

  it("keys fragment figure targets by refPath or the synthetic slot", () => {
    const parsed = stage1({
      pageNo: 1,
      isRelevant: true,
      startState: {
        refPath: null,
        obj: {
          passage: null,
          question: null,
          solution: null,
          options: {
            A: { text: "alpha", hasFigure: true },
            B: null,
            C: null,
            D: null,
          },
          answerKey: null,
        },
      },
      endState: {
        refPath: ["30"],
      },
      sections: null,
      entities: [
        {
          path: ["30"],
          passage: null,
          question: {
            text: "Question thirty.",
            hasFigure: true,
            marks: null,
            subject: null,
            isStandalone: true,
          },
          solution: null,
          options: null,
          answerKey: null,
        },
      ],
    });

    expect(collectFigureTargets(parsed)).toEqual([
      {
        path: ["30"],
        needs: { question: true, solution: false, options: [] },
        questionText: "Question thirty.",
        optionTexts: undefined,
      },
      {
        path: ["@start"],
        needs: { question: false, solution: false, options: ["A"] },
        questionText: undefined,
        optionTexts: { A: "alpha" },
      },
    ]);
  });

  it("merges stage-2 boxes into the merged boundary states", () => {
    const s1 = stage1({
      pageNo: 1,
      isRelevant: true,
      startState: {
        refPath: null,
        obj: {
          passage: null,
          question: null,
          solution: null,
          options: {
            A: { text: "alpha", hasFigure: true },
            B: null,
            C: null,
            D: null,
          },
          answerKey: null,
        },
      },
      endState: {
        refPath: ["30"],
      },
      sections: null,
      entities: [
        {
          path: ["30"],
          passage: null,
          question: {
            text: "Question thirty.",
            hasFigure: true,
            marks: null,
            subject: null,
            isStandalone: true,
          },
          solution: null,
          options: null,
          answerKey: null,
        },
      ],
    });
    const s2 = stage2([
      {
        path: ["@start"],
        questionFigures: [],
        solutionFigures: [],
        optionFigures: { A: nativeBox, B: null, C: null, D: null },
      },
      {
        path: ["30"],
        questionFigures: [nativeBox],
        solutionFigures: [],
        optionFigures: null,
      },
    ]);

    const merged = mergeStage1AndStage2(s1, s2);
    expect(merged.startState.refPath).toBeNull();
    expect(merged.startState.obj?.options?.A?.figure).toEqual(unitBox);
    expect(merged.startState.obj?.figureResolved).toBe(true);
    expect(merged.endState.refPath).toEqual(["30"]);
    // The bottom entity's figure lives under its path in entities.
    expect(merged.entities[0].path).toEqual(["30"]);
    expect(merged.entities[0].question?.figures).toEqual([unitBox]);
  });

  it("degrades a fragment whose requested box went missing (figureResolved=false)", () => {
    const s1 = stage1({
      pageNo: 1,
      isRelevant: true,
      startState: {
        refPath: null,
        obj: {
          passage: null,
          question: {
            text: "Fragment stem.",
            hasFigure: true,
            marks: null,
            subject: null,
            isStandalone: true,
          },
          solution: null,
          options: null,
          answerKey: null,
        },
      },
      endState: { refPath: null, obj: null },
      sections: null,
      entities: [],
    });
    const s2 = stage2([
      {
        path: ["@start"],
        questionFigures: [],
        solutionFigures: [],
        optionFigures: null,
      },
    ]);

    const merged = mergeStage1AndStage2(s1, s2);
    expect(merged.startState.obj?.question?.figures).toEqual([]);
    expect(merged.startState.obj?.figureResolved).toBe(false);
  });
});

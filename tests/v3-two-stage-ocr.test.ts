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
} from "../src/inngest/functions/v3/ocr-page/new-schema";

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
  it("parses path-identified entities with hasFigure flags", () => {
    const parsed = stage1({
      pageNo: 1,
      isRelevant: true,
      isStartOpen: false,
      isEndOpen: false,
      sections: null,
      entities: [
        {
          path: ["4", "ii"],
          passage: null,
          question: {
            text: "Sub question (ii).",
            hasFigure: false,
            marks: null,
            difficulty: null,
            subject: "grammar",
            isStandalone: true
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
      isStartOpen: true,
      isEndOpen: false,
      sections: null,
      entities: [
        {
          path: null,
          question: {
            text: "...continued.",
            hasFigure: false,
            marks: null,
            difficulty: null,
            subject: null,
            isStandalone: true
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
      isStartOpen: false,
      isEndOpen: false,
      sections: null,
      entities: [
        {
          path: ["9"],
          question: { text: "q", hasFigure: true },
          solution: { text: "s", hasFigure: false },
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
          question: { text: "q2", hasFigure: false },
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
      },
    ]);
  });

  it("merges duplicate unlabeled targets and throws on two unlabeled entities", () => {
    const single = stage1({
      pageNo: 1,
      isRelevant: true,
      isStartOpen: true,
      isEndOpen: false,
      sections: null,
      entities: [
        { path: null, question: { text: "q", hasFigure: true }, solution: null, options: null, answerKey: null },
      ],
    });
    expect(collectFigureTargets(single)).toEqual([
      { path: null, needs: { question: true, solution: false, options: [] } },
    ]);

    const ambiguous = stage1({
      pageNo: 1,
      isRelevant: true,
      isStartOpen: true,
      isEndOpen: false,
      sections: null,
      entities: [
        { path: null, question: { text: "q1", hasFigure: true }, solution: null, options: null, answerKey: null },
        { path: null, question: { text: "q2", hasFigure: true }, solution: null, options: null, answerKey: null },
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
      isStartOpen: false,
      isEndOpen: false,
      sections: null,
      entities: [
        {
          path: ["2"],
          question: { text: "Which circuit?", hasFigure: true },
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
      isStartOpen: true,
      isEndOpen: false,
      sections: null,
      entities: [
        { path: null, question: { text: "...continued", hasFigure: true }, solution: null, options: null, answerKey: null },
      ],
    });
    const s2 = stage2([
      { path: null, questionFigures: [nativeBox], solutionFigures: [], optionFigures: null },
    ]);

    const merged = mergeStage1AndStage2(s1, s2);
    expect(merged.entities[0].question?.figures).toEqual([unitBox]);
  });

  it("throws on duplicate stage-2 paths", () => {
    const s1 = stage1({
      pageNo: 1, isRelevant: true, isStartOpen: false, isEndOpen: false, sections: null, entities: [],
    });
    const s2 = stage2([
      { path: ["1"], questionFigures: [], solutionFigures: [], optionFigures: null },
      { path: ["1"], questionFigures: [], solutionFigures: [], optionFigures: null },
    ]);
    expect(() => mergeStage1AndStage2(s1, s2)).toThrow(OcrMergeError);
  });

  it("throws when stage-2 reports an unrequested path", () => {
    const s1 = stage1({
      pageNo: 1, isRelevant: true, isStartOpen: false, isEndOpen: false, sections: null, entities: [],
    });
    const s2 = stage2([
      { path: ["7"], questionFigures: [], solutionFigures: [], optionFigures: null },
    ]);
    expect(() => mergeStage1AndStage2(s1, s2)).toThrow(OcrMergeError);
  });

  it("throws when hasFigure=true but stage-2 has no box (empty array counts as missing)", () => {
    const s1 = stage1({
      pageNo: 1,
      isRelevant: true,
      isStartOpen: false,
      isEndOpen: false,
      sections: null,
      entities: [
        { path: ["1"], question: { text: "q", hasFigure: true }, solution: null, options: null, answerKey: null },
      ],
    });
    const s2 = stage2([
      { path: ["1"], questionFigures: [], solutionFigures: [], optionFigures: null },
    ]);
    expect(() => mergeStage1AndStage2(s1, s2)).toThrow(OcrMergeError);
  });

  it("throws when hasFigure=false but stage-2 reports figures", () => {
    const s1 = stage1({
      pageNo: 1,
      isRelevant: true,
      isStartOpen: false,
      isEndOpen: false,
      sections: null,
      entities: [
        { path: ["1"], question: { text: "q", hasFigure: false }, solution: null, options: null, answerKey: null },
      ],
    });
    const s2 = stage2([
      { path: ["1"], questionFigures: [nativeBox], solutionFigures: [], optionFigures: null },
    ]);
    expect(() => mergeStage1AndStage2(s1, s2)).toThrow(OcrMergeError);
  });

  it("throws when two unlabeled stage-1 entities with figures exist", () => {
    const s1 = stage1({
      pageNo: 1,
      isRelevant: true,
      isStartOpen: true,
      isEndOpen: false,
      sections: null,
      entities: [
        { path: null, question: { text: "q1", hasFigure: true }, solution: null, options: null, answerKey: null },
        { path: null, question: { text: "q2", hasFigure: true }, solution: null, options: null, answerKey: null },
      ],
    });
    expect(() => mergeStage1AndStage2(s1, { items: [] })).toThrow(OcrMergeError);
  });
});

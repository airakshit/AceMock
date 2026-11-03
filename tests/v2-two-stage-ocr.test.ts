import { describe, expect, it } from "vitest";
import { mergeOcrResults } from "../src/inngest/functions/v2/extract-questions/merge-ocr-results";
import { OcrMergeError } from "../src/inngest/functions/v2/ocr-page/errors";
import {
  collectFiguresToExtract,
  mergeStage1AndStage2,
  parsePartialStructuredOCR,
  parseStage2BoundingBoxes,
} from "../src/inngest/functions/v2/ocr-page/utils";

/** Parses a stage-1 response and asserts it survived validation. */
function stage1(data: unknown) {
  const result = parsePartialStructuredOCR(JSON.stringify(data));
  expect(result.survivedValidation).toBe(true);
  expect(result.parsedStructuredData).toBeDefined();
  return result.parsedStructuredData!;
}

/** Parses a stage-2 response and asserts it survived validation. */
function stage2(items: unknown[]) {
  const result = parseStage2BoundingBoxes(JSON.stringify({ items }));
  expect(result.survivedValidation).toBe(true);
  expect(result.parsedStructuredData).toBeDefined();
  return result.parsedStructuredData!;
}

const nativeBox = { xMin: 100, yMin: 200, xMax: 300, yMax: 400 };
const unitBox = { xMin: 0.1, yMin: 0.2, xMax: 0.3, yMax: 0.4 };

describe("v2 two-stage OCR: stage 1 parsing", () => {
  it("parses hasFigure flags without any bounding boxes", () => {
    const parsed = stage1({
      isRelevant: true,
      data: [
        {
          serialNo: 1,
          question: { text: "Text only", hasFigure: false },
          options: {
            A: { text: "a", hasFigure: false },
            B: { text: null, hasFigure: true },
            C: null,
            D: null,
          },
          answerKey: "B",
          subject: "physics",
          marks: null,
          solution: { text: "", hasFigure: true },
          isContinuation: false,
        },
      ],
    });

    expect(parsed.data[0].question?.hasFigure).toBe(false);
    expect(parsed.data[0].options?.B?.hasFigure).toBe(true);
    expect(parsed.data[0].solution?.hasFigure).toBe(true);
  });
});

describe("v2 two-stage OCR: collectFiguresToExtract", () => {
  it("collects exactly the fields flagged hasFigure=true", () => {
    const parsed = stage1({
      isRelevant: true,
      data: [
        {
          serialNo: 9,
          question: { text: "q", hasFigure: true },
          options: {
            A: { text: null, hasFigure: true },
            B: { text: "b", hasFigure: false },
            C: null,
            D: null,
          },
          answerKey: null,
          subject: "physics",
          marks: null,
          solution: null,
          isContinuation: false,
        },
        {
          serialNo: 10,
          question: { text: "q2", hasFigure: false },
          options: null,
          answerKey: "C",
          subject: null,
          marks: null,
          solution: { text: "s", hasFigure: true },
          isContinuation: false,
        },
      ],
    });

    expect(collectFiguresToExtract(parsed)).toEqual([
      { serialNo: 9, kind: "question", index: 0 },
      { serialNo: 9, kind: "option", index: "A" },
      { serialNo: 10, kind: "solution", index: 0 },
    ]);
  });
});

describe("v2 two-stage OCR: strict merge", () => {
  it("merges stage-1 text with stage-2 boxes and rescales 0-1000 -> 0-1", () => {
    const s1 = stage1({
      isRelevant: true,
      data: [
        {
          serialNo: 2,
          question: { text: "Which circuit?", hasFigure: true },
          options: {
            A: { text: null, hasFigure: true },
            B: { text: "text b", hasFigure: false },
            C: { text: "text c", hasFigure: false },
            D: null,
          },
          answerKey: "A",
          subject: "physics",
          marks: null,
          solution: null,
          isContinuation: false,
        },
      ],
    });
    const s2 = stage2([
      {
        serialNo: 2,
        questionFigures: [nativeBox],
        solutionFigures: [],
        optionFigures: {
          A: { xMin: 100, yMin: 200, xMax: 300, yMax: 400 },
          B: null,
          C: null,
          D: null,
        },
      },
    ]);

    const merged = mergeStage1AndStage2(s1, s2);
    const item = merged.data![0];

    expect(item.question).toEqual({ text: "Which circuit?", figures: [unitBox] });
    expect(item.options?.A?.figure).toEqual(unitBox);
    expect(item.options?.A?.text).toBeUndefined();
    expect(item.options?.B).toEqual({ text: "text b" });
    expect(item.options?.C).toEqual({ text: "text c" });
    expect(item.solution).toBeUndefined();
  });

  it("throws when stage-2 reports a duplicate serialNo", () => {
    const s1 = stage1({ isRelevant: true, data: [] });
    const s2 = stage2([
      { serialNo: 1, questionFigures: [], solutionFigures: [], optionFigures: null },
      { serialNo: 1, questionFigures: [], solutionFigures: [], optionFigures: null },
    ]);

    expect(() => mergeStage1AndStage2(s1, s2)).toThrow(OcrMergeError);
  });

  it("throws when stage-2 serialNo does not exist in stage-1", () => {
    const s1 = stage1({
      isRelevant: true,
      data: [
        {
          serialNo: 1,
          question: { text: "q", hasFigure: false },
          options: null,
          answerKey: null,
          subject: null,
          marks: null,
          solution: null,
          isContinuation: false,
        },
      ],
    });
    const s2 = stage2([
      { serialNo: 2, questionFigures: [nativeBox], solutionFigures: [], optionFigures: null },
    ]);

    expect(() => mergeStage1AndStage2(s1, s2)).toThrow(OcrMergeError);
  });

  it("throws when hasFigure=true but stage-2 provides no box", () => {
    const s1 = stage1({
      isRelevant: true,
      data: [
        {
          serialNo: 1,
          question: { text: "q", hasFigure: true },
          options: null,
          answerKey: null,
          subject: null,
          marks: null,
          solution: null,
          isContinuation: false,
        },
      ],
    });
    const s2 = stage2([
      { serialNo: 1, questionFigures: [], solutionFigures: [], optionFigures: null },
    ]);

    expect(() => mergeStage1AndStage2(s1, s2)).toThrow(OcrMergeError);
  });

  it("throws when hasFigure=false but stage-2 provides a box", () => {
    const s1 = stage1({
      isRelevant: true,
      data: [
        {
          serialNo: 1,
          question: { text: "q", hasFigure: false },
          options: null,
          answerKey: null,
          subject: null,
          marks: null,
          solution: null,
          isContinuation: false,
        },
      ],
    });
    const s2 = stage2([
      { serialNo: 1, questionFigures: [nativeBox], solutionFigures: [], optionFigures: null },
    ]);

    expect(() => mergeStage1AndStage2(s1, s2)).toThrow(OcrMergeError);
  });

  it("produces output consumable by the merge-ocr-results stage", () => {
    const s1 = stage1({
      isRelevant: true,
      sectionLabel: "Section-I",
      data: [
        {
          serialNo: 5,
          question: { text: "Find $x$.", hasFigure: true },
          options: {
            A: { text: "1", hasFigure: false },
            B: { text: "2", hasFigure: false },
            C: { text: "3", hasFigure: false },
            D: { text: "4", hasFigure: false },
          },
          answerKey: "B",
          subject: "maths",
          marks: 1,
          solution: null,
          isContinuation: false,
        },
      ],
    });
    const s2 = stage2([
      { serialNo: 5, questionFigures: [nativeBox], solutionFigures: [], optionFigures: null },
    ]);

    const merged = mergeStage1AndStage2(s1, s2);
    const mergedResults = mergeOcrResults([
      {
        pageNo: 1,
        pageId: "page-1",
        fileId: "file-1",
        rawText: null,
        status: "completed",
        survivedValidation: true,
        isRelevant: true,
        parsedData: merged,
      },
    ]);

    expect(mergedResults[0].question).toContain("Find $x$.");
    expect(mergedResults[0].questionFigures).toHaveLength(1);
    expect(mergedResults[0].questionFigures?.[0]).toMatchObject(unitBox);
    expect(mergedResults[0].correctOption).toBe("B");
  });
});